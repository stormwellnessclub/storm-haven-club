import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecommendationRequest {
  type: 'class_recommendations' | 'fitness_tips' | 'schedule_optimization' | 'workout_generation' | 'program_generation';
  preferences?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    console.error("LOVABLE_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "AI service not configured" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Authenticate the user via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = user.id;
    console.log(`Authenticated user: ${userId}`);

    const { type, preferences }: RecommendationRequest = await req.json();
    console.log(`Processing AI recommendation type: ${type} for user: ${userId}`);

    // Validate request type
    const validTypes = ['class_recommendations', 'fitness_tips', 'schedule_optimization', 'workout_generation', 'program_generation'];
    if (!type || !validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid recommendation type" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get member_id for this user
    let memberId = null;
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (member) {
      memberId = member.id;
    }

    // Get user's booking history using authenticated userId
    let userHistory = null;
    const { data: bookings } = await supabase
      .from('class_bookings')
      .select(`
        *,
        class_sessions (
          session_date,
          start_time,
          class_types (name, category, is_heated)
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('booked_at', { ascending: false })
      .limit(20);
    
    userHistory = bookings;

    // Get available class types
    const { data: classTypes } = await supabase
      .from('class_types')
      .select('*')
      .eq('is_active', true);

    // Get fitness profile for workout generation
    let fitnessProfile = null;
    let equipmentDetails = null;
    let workoutLogs = null;
    if (memberId) {
      const { data: profile } = await supabase
        .from('member_fitness_profiles')
        .select('*')
        .eq('member_id', memberId)
        .maybeSingle();
      
      fitnessProfile = profile;

      // Fetch equipment details if equipment_ids exist
      if (profile?.equipment_ids && profile.equipment_ids.length > 0) {
        const { data: equipment } = await supabase
          .from('equipment')
          .select('id, name, category, description, image_url, technogym_id, technogym_exercise_id')
          .in('id', profile.equipment_ids)
          .eq('is_active', true);
        
        equipmentDetails = equipment || [];
      }

      // Fetch user's workout logs for personalization
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('workout_type, workout_name, duration_minutes, exercises, performed_at')
        .eq('member_id', memberId)
        .order('performed_at', { ascending: false })
        .limit(10);
      
      workoutLogs = logs || [];
    }

    let systemPrompt = '';
    let userPrompt = '';

    switch (type) {
      case 'class_recommendations':
        systemPrompt = `You are a fitness expert at Storm Wellness Club. Recommend classes based on user preferences and history. Be encouraging and specific. Keep responses concise and actionable.`;
        userPrompt = `
          Available classes: ${JSON.stringify(classTypes?.map(c => ({ name: c.name, category: c.category, description: c.description, isHeated: c.is_heated })))}
          
          User's recent classes: ${userHistory ? JSON.stringify(userHistory.map((b: any) => b.class_sessions?.class_types?.name)) : 'No history'}
          
          User preferences: ${JSON.stringify(preferences || {})}
          
          Recommend 3 classes for this user with brief explanations why.
        `;
        break;

      case 'fitness_tips':
        systemPrompt = `You are a wellness coach at Storm Wellness Club. Provide personalized fitness and wellness tips. Be encouraging, practical, and concise.`;
        userPrompt = `
          User's recent activity: ${userHistory ? JSON.stringify(userHistory.slice(0, 5).map((b: any) => b.class_sessions?.class_types?.name)) : 'New member'}
          
          User preferences: ${JSON.stringify(preferences || {})}
          
          Provide 3 personalized fitness or wellness tips for this user.
        `;
        break;

      case 'schedule_optimization':
        systemPrompt = `You are a scheduling expert at Storm Wellness Club. Help users optimize their workout schedule for consistency and results. Be practical and encouraging.`;
        userPrompt = `
          User's booking patterns: ${userHistory ? JSON.stringify(userHistory.map((b: any) => ({
            day: new Date(b.class_sessions?.session_date).toLocaleDateString('en-US', { weekday: 'long' }),
            time: b.class_sessions?.start_time,
            class: b.class_sessions?.class_types?.name
          }))) : 'No history'}
          
          Preferences: ${JSON.stringify(preferences || {})}
          
          Suggest an optimal weekly workout schedule based on their patterns and preferences.
        `;
        break;

      case 'workout_generation':
        if (!memberId) {
          return new Response(
            JSON.stringify({ error: "Member profile required for workout generation" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Get user preferences from request
        const workoutPrefs = preferences || {};
        const targetWorkoutType = workoutPrefs.workoutType || 'mixed';
        const targetBodyParts = workoutPrefs.targetBodyParts || [];
        const targetDuration = workoutPrefs.duration || fitnessProfile?.available_time_minutes || 35;
        const targetIntensity = workoutPrefs.intensity || 'moderate';

        // Fetch ALL active equipment from database for workout generation
        const { data: allEquipment } = await supabase
          .from('equipment')
          .select('id, name, category, description, image_url, technogym_id, technogym_exercise_id')
          .eq('is_active', true)
          .order('display_order');
        
        equipmentDetails = allEquipment || [];

        systemPrompt = `You are a personal trainer at Storm Wellness Club. Generate a personalized workout plan based on member preferences and available gym equipment.

AVAILABLE GYM EQUIPMENT (Prioritize using this equipment in your workout):
${equipmentDetails.map((eq: any) => `- ${eq.name} (${eq.category})${eq.description ? `: ${eq.description}` : ''}${eq.technogym_id ? ' [Technogym]' : ''}`).join('\n')}

WORKOUT REQUEST:
- Workout Type: ${targetWorkoutType}
- Target Body Parts: ${targetBodyParts.length > 0 ? targetBodyParts.join(', ') : 'Full body'}
- Duration: ${targetDuration} minutes
- Intensity: ${targetIntensity}

MEMBER PROFILE:
- Fitness Level: ${fitnessProfile?.fitness_level || 'intermediate'}
- Primary Goal: ${fitnessProfile?.primary_goal || 'general fitness'}
- Injuries/Limitations: ${JSON.stringify(fitnessProfile?.injuries_limitations || [])}

Generate a complete workout in valid JSON format. For each exercise:
1. Use equipment from the gym's available list when possible
2. Include clear instructions and form cues
3. Match the requested intensity level
4. Target the specified body parts

Return ONLY valid JSON with no markdown formatting:`;

        userPrompt = `{
  "workout_name": "Descriptive name based on ${targetWorkoutType} and ${targetBodyParts.join(', ') || 'full body'}",
  "workout_type": "${targetWorkoutType}",
  "duration_minutes": ${targetDuration},
  "difficulty": "${targetIntensity === 'light' ? 'beginner' : targetIntensity === 'intense' ? 'advanced' : 'intermediate'}",
  "exercises": [
    {
      "name": "Exercise name",
      "sets": 3,
      "reps": "10-12",
      "weight": "bodyweight or specific weight",
      "duration": "for timed exercises like 30 seconds",
      "rest": "60 seconds between sets",
      "equipment": "equipment from gym list",
      "targetMuscle": "primary muscle targeted",
      "bodyPart": "body part category",
      "notes": "Form tips and technique cues",
      "instructions": ["Step 1...", "Step 2...", "Step 3..."]
    }
  ],
  "reasoning": "Brief explanation of why this workout suits the member's goals"
}

Generate 5-8 exercises for a ${targetDuration} minute ${targetWorkoutType} workout targeting ${targetBodyParts.length > 0 ? targetBodyParts.join(', ') : 'full body'} at ${targetIntensity} intensity.`;
        break;

      case 'program_generation':
        if (!memberId) {
          return new Response(
            JSON.stringify({ error: "Member profile required for program generation" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const programPrefs = preferences || {};
        const programType = programPrefs.programType || 'strength';
        const daysPerWeek = programPrefs.daysPerWeek || 4;
        const programDuration = programPrefs.durationWeeks || 4;
        const splitType = programPrefs.splitType || 'push_pull_legs';
        const targetParts = programPrefs.targetBodyParts || [];

        // Fetch ALL active equipment
        const { data: programEquipment } = await supabase
          .from('equipment')
          .select('id, name, category, description')
          .eq('is_active', true)
          .order('display_order');

        systemPrompt = `You are an expert personal trainer at Storm Wellness Club creating a ${programDuration}-week structured workout program.

AVAILABLE GYM EQUIPMENT:
${(programEquipment || []).map((eq: any) => `- ${eq.name} (${eq.category})`).join('\n')}

PROGRAM REQUIREMENTS:
- Program Type: ${programType}
- Duration: ${programDuration} weeks
- Days Per Week: ${daysPerWeek}
- Split Type: ${splitType}
- Target Areas: ${targetParts.length > 0 ? targetParts.join(', ') : 'Balanced full body'}

MEMBER PROFILE:
- Fitness Level: ${fitnessProfile?.fitness_level || 'intermediate'}
- Primary Goal: ${fitnessProfile?.primary_goal || 'general fitness'}
- Injuries/Limitations: ${JSON.stringify(fitnessProfile?.injuries_limitations || [])}

Create a progressive program that:
1. Builds intensity across weeks
2. Balances muscle groups appropriately
3. Includes proper warm-up and cool-down exercises
4. Uses available gym equipment
5. Matches the member's fitness level

Return ONLY valid JSON with no markdown:`;

        userPrompt = `{
  "program_name": "Descriptive program name",
  "program_type": "${programType}",
  "duration_weeks": ${programDuration},
  "days_per_week": ${daysPerWeek},
  "split_type": "${splitType}",
  "difficulty": "${fitnessProfile?.fitness_level || 'intermediate'}",
  "target_body_parts": ${JSON.stringify(targetParts.length > 0 ? targetParts : ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'])},
  "progression_style": "linear",
  "reasoning": "Brief explanation of the program design",
  "workouts": [
    {
      "week_number": 1,
      "day_number": 1,
      "workout_name": "Day 1 - Focus Area",
      "workout_type": "strength/cardio/flexibility",
      "focus_area": "chest and triceps",
      "duration_minutes": 45,
      "exercises": [
        {
          "name": "Exercise name",
          "sets": 3,
          "reps": "10-12",
          "weight": "moderate",
          "rest": "60 seconds",
          "equipment": "from gym list",
          "targetMuscle": "primary muscle",
          "notes": "Form tips",
          "instructions": ["Step 1", "Step 2"]
        }
      ],
      "notes": "Session focus notes"
    }
  ]
}

Generate a complete ${programDuration}-week program with ${daysPerWeek} workouts per week. Each workout should have 5-7 exercises.`;
        break;

      default:
        throw new Error(`Unknown recommendation type: ${type}`);
    }

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const recommendation = aiData.choices?.[0]?.message?.content;

    console.log("AI recommendation generated successfully for user:", userId);

    // For workout generation, parse JSON and save to database
    if (type === 'workout_generation' && memberId) {
      try {
        // Extract JSON from response (may have markdown code blocks)
        let workoutData = recommendation;
        if (workoutData.includes('```json')) {
          workoutData = workoutData.split('```json')[1].split('```')[0].trim();
        } else if (workoutData.includes('```')) {
          workoutData = workoutData.split('```')[1].split('```')[0].trim();
        }
        
        const workoutJson = JSON.parse(workoutData);
        
        // Save to ai_workouts table
        const { data: savedWorkout, error: saveError } = await supabase
          .from('ai_workouts')
          .insert({
            member_id: memberId,
            workout_name: workoutJson.workout_name,
            workout_type: workoutJson.workout_type,
            duration_minutes: workoutJson.duration_minutes,
            difficulty: workoutJson.difficulty,
            exercises: workoutJson.exercises,
            ai_reasoning: workoutJson.reasoning
          })
          .select()
          .single();

        if (saveError) {
          console.error("Error saving workout:", saveError);
          return new Response(
            JSON.stringify({ 
              type,
              workout: workoutJson,
              saved: false,
              error: "Failed to save workout to database",
              generatedAt: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        return new Response(
          JSON.stringify({ 
            type,
            workout: workoutJson,
            workout_id: savedWorkout.id,
            saved: true,
            generatedAt: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (parseError) {
        console.error("Error parsing workout JSON:", parseError);
        return new Response(
          JSON.stringify({ 
            type,
            recommendation,
            error: "Failed to parse workout data",
            generatedAt: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // For program generation, parse JSON and save to database
    if (type === 'program_generation' && memberId) {
      try {
        let programData = recommendation;
        if (programData.includes('```json')) {
          programData = programData.split('```json')[1].split('```')[0].trim();
        } else if (programData.includes('```')) {
          programData = programData.split('```')[1].split('```')[0].trim();
        }
        
        const programJson = JSON.parse(programData);
        
        // Deactivate any existing active programs for this member
        await supabase
          .from('workout_programs')
          .update({ is_active: false })
          .eq('member_id', memberId)
          .eq('is_active', true);

        // Save the program
        const { data: savedProgram, error: programError } = await supabase
          .from('workout_programs')
          .insert({
            member_id: memberId,
            user_id: userId,
            program_name: programJson.program_name,
            program_type: programJson.program_type,
            duration_weeks: programJson.duration_weeks,
            days_per_week: programJson.days_per_week,
            split_type: programJson.split_type,
            difficulty: programJson.difficulty,
            target_body_parts: programJson.target_body_parts,
            progression_style: programJson.progression_style || 'linear',
            ai_reasoning: programJson.reasoning,
            is_active: true,
            started_at: new Date().toISOString()
          })
          .select()
          .single();

        if (programError) {
          console.error("Error saving program:", programError);
          return new Response(
            JSON.stringify({ 
              type,
              program: programJson,
              saved: false,
              error: "Failed to save program to database",
              generatedAt: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Save individual workouts
        const workoutsToInsert = programJson.workouts.map((w: any) => ({
          program_id: savedProgram.id,
          week_number: w.week_number,
          day_number: w.day_number,
          workout_name: w.workout_name,
          workout_type: w.workout_type || programJson.program_type,
          focus_area: w.focus_area,
          duration_minutes: w.duration_minutes,
          exercises: w.exercises,
          notes: w.notes
        }));

        const { error: workoutsError } = await supabase
          .from('program_workouts')
          .insert(workoutsToInsert);

        if (workoutsError) {
          console.error("Error saving program workouts:", workoutsError);
        }

        return new Response(
          JSON.stringify({ 
            type,
            program: programJson,
            program_id: savedProgram.id,
            saved: true,
            generatedAt: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (parseError) {
        console.error("Error parsing program JSON:", parseError);
        return new Response(
          JSON.stringify({ 
            type,
            recommendation,
            error: "Failed to parse program data",
            generatedAt: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        type,
        recommendation,
        generatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("AI recommendation error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
