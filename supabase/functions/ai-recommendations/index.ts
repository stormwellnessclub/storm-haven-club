import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecommendationRequest {
  type: 'class_recommendations' | 'fitness_tips' | 'schedule_optimization' | 'workout_generation';
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
    const validTypes = ['class_recommendations', 'fitness_tips', 'schedule_optimization', 'workout_generation'];
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

        systemPrompt = `You are a personal trainer and fitness coach at Storm Wellness Club. Generate personalized workout plans based on member goals, fitness level, available equipment, and time constraints. Return workouts in JSON format with exercises including sets, reps, weight (if applicable), duration, and rest periods. Be specific, safe, and progressive. Use the ExerciseDB exercise data provided when creating exercises - match exercise names exactly from the provided list when possible.`;
        
        // Fetch ExerciseDB exercises based on equipment and goals
        let exercisedbExercises: any[] = [];
        const exercisedbApiKey = Deno.env.get('EXERCISEDB_API_KEY') || Deno.env.get('RAPIDAPI_KEY');
        
        if (exercisedbApiKey && equipmentDetails && equipmentDetails.length > 0) {
          try {
            // Map equipment categories to ExerciseDB equipment types
            const equipmentMapping: Record<string, string> = {
              'cardio': 'body weight',
              'strength': 'body weight',
              'free_weights': 'dumbbell',
              'machines': 'leverage machine',
              'functional': 'body weight',
              'accessories': 'body weight',
              'recovery': 'body weight',
            };

            // Get unique equipment types
            const equipmentTypes = [...new Set(
              equipmentDetails.map((eq: any) => {
                const mapped = equipmentMapping[eq.category?.toLowerCase()] || 'body weight';
                return mapped.toLowerCase().replace(/\s+/g, '');
              })
            )];

            // Fetch exercises for each equipment type (limit to avoid too many requests)
            for (const equipType of equipmentTypes.slice(0, 3)) {
              try {
                const response = await fetch(
                  `https://exercisedb.p.rapidapi.com/exercises/equipment/${equipType}`,
                  {
                    headers: {
                      'X-RapidAPI-Key': exercisedbApiKey,
                      'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
                    },
                  }
                );

                if (response.ok) {
                  const exercises = await response.json();
                  exercisedbExercises = [...exercisedbExercises, ...(exercises.slice(0, 20))];
                }
              } catch (error) {
                console.error(`Error fetching ExerciseDB exercises for ${equipType}:`, error);
              }
            }

            // Also fetch by target muscles if we have goal information
            if (fitnessProfile?.primary_goal) {
              const goalMapping: Record<string, string> = {
                'weight_loss': 'cardio',
                'muscle_gain': 'pectorals',
                'strength': 'pectorals',
                'endurance': 'cardio',
                'flexibility': 'stretch',
              };

              const targetMuscle = goalMapping[fitnessProfile.primary_goal.toLowerCase()] || 'pectorals';
              try {
                const response = await fetch(
                  `https://exercisedb.p.rapidapi.com/exercises/target/${targetMuscle}`,
                  {
                    headers: {
                      'X-RapidAPI-Key': exercisedbApiKey,
                      'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
                    },
                  }
                );

                if (response.ok) {
                  const exercises = await response.json();
                  exercisedbExercises = [...exercisedbExercises, ...(exercises.slice(0, 15))];
                }
              } catch (error) {
                console.error(`Error fetching ExerciseDB exercises for target ${targetMuscle}:`, error);
              }
            }

            // Remove duplicates
            const uniqueExercises = Array.from(
              new Map(exercisedbExercises.map((ex: any) => [ex.id, ex])).values()
            );
            exercisedbExercises = uniqueExercises.slice(0, 50); // Limit to 50 exercises
          } catch (error) {
            console.error("Error fetching ExerciseDB exercises:", error);
            // Continue without ExerciseDB data if it fails
          }
        }
        
        // Format equipment details for AI prompt
        const equipmentList = equipmentDetails?.map((eq: any) => ({
          name: eq.name,
          category: eq.category,
          description: eq.description,
          technogym_id: eq.technogym_id,
        })) || [];
        
        const equipmentText = equipmentList.length > 0 
          ? `\n          Available Equipment Details:\n          ${equipmentList.map((eq: any) => `- ${eq.name} (${eq.category}): ${eq.description || 'No description'}${eq.technogym_id ? ` [Technogym ID: ${eq.technogym_id}]` : ''}`).join('\n          ')}`
          : `\n          Available Equipment: ${JSON.stringify(fitnessProfile?.available_equipment || [])}`;
        
        // Format ExerciseDB exercises for AI prompt
        const exercisedbText = exercisedbExercises.length > 0
          ? `\n\n          EXERCISE DATABASE (ExerciseDB) - Use these exact exercise names when possible:\n          ${exercisedbExercises.map((ex: any) => 
              `- ${ex.name} (Target: ${ex.target}, Body Part: ${ex.bodyPart}, Equipment: ${ex.equipment}${ex.instructions && ex.instructions.length > 0 ? `, Instructions: ${ex.instructions.slice(0, 2).join('; ')}` : ''})`
            ).join('\n          ')}\n          
          IMPORTANT: When creating exercises in the workout, use the exact exercise names from the ExerciseDB list above when they match your workout plan. Include the exercise instructions and target muscles.`
          : '';
        
        // Format workout history
        const workoutHistoryText = workoutLogs && workoutLogs.length > 0
          ? `\n          Recent Workout Logs:\n          ${workoutLogs.map((log: any) => 
              `- ${log.workout_name || log.workout_type} (${log.workout_type}, ${log.duration_minutes || '?'} min, ${new Date(log.performed_at).toLocaleDateString()})`
            ).join('\n          ')}\n          Use this history to avoid repetition and build progression.`
          : '          No previous workout logs found.';
        
        userPrompt = `
          Member Fitness Profile:
          - Fitness Level: ${fitnessProfile?.fitness_level || 'Not specified'}
          - Primary Goal: ${fitnessProfile?.primary_goal || 'Not specified'}
          - Secondary Goals: ${JSON.stringify(fitnessProfile?.secondary_goals || [])}${equipmentText}
          - Available Time: ${fitnessProfile?.available_time_minutes || 30} minutes
          - Workout Preferences: ${JSON.stringify(fitnessProfile?.workout_preferences || {})}
          - Injuries/Limitations: ${JSON.stringify(fitnessProfile?.injuries_limitations || [])}
          
          ${workoutHistoryText}
          
          Recent Class Bookings: ${userHistory ? JSON.stringify(userHistory.slice(0, 5).map((b: any) => b.class_sessions?.class_types?.name)) : 'No recent class bookings'}${exercisedbText}
          
          Generate a complete workout plan in this JSON format. When creating exercises, prefer using exact exercise names from the ExerciseDB list provided above. Include exercise instructions and form cues:
          {
            "workout_name": "Descriptive workout name",
            "workout_type": "strength|cardio|hiit|yoga|pilates|mixed",
            "duration_minutes": ${fitnessProfile?.available_time_minutes || 30},
            "difficulty": "beginner|intermediate|advanced",
            "exercises": [
              {
                "name": "Exercise name (use exact name from ExerciseDB when available)",
                "sets": 3,
                "reps": "10-12",
                "weight": "bodyweight|or specific weight",
                "duration_seconds": null or number,
                "rest_seconds": 60,
                "notes": "Form cues, instructions, or modifications"
              }
            ],
            "reasoning": "Brief explanation of why this workout suits the member's goals and profile"
          }
        `;
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
          // Still return the workout even if save fails
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
        // Return raw response if parsing fails
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
