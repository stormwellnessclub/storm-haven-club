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
    if (memberId) {
      const { data: profile } = await supabase
        .from('member_fitness_profiles')
        .select('*')
        .eq('member_id', memberId)
        .maybeSingle();
      
      fitnessProfile = profile;
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

        systemPrompt = `You are a personal trainer and fitness coach at Storm Wellness Club. Generate personalized workout plans based on member goals, fitness level, available equipment, and time constraints. Return workouts in JSON format with exercises including sets, reps, weight (if applicable), duration, and rest periods. Be specific, safe, and progressive.`;
        userPrompt = `
          Member Fitness Profile:
          - Fitness Level: ${fitnessProfile?.fitness_level || 'Not specified'}
          - Primary Goal: ${fitnessProfile?.primary_goal || 'Not specified'}
          - Secondary Goals: ${JSON.stringify(fitnessProfile?.secondary_goals || [])}
          - Available Equipment: ${JSON.stringify(fitnessProfile?.available_equipment || [])}
          - Available Time: ${fitnessProfile?.available_time_minutes || 30} minutes
          - Workout Preferences: ${JSON.stringify(fitnessProfile?.workout_preferences || {})}
          - Injuries/Limitations: ${JSON.stringify(fitnessProfile?.injuries_limitations || [])}
          
          Recent Workout History: ${userHistory ? JSON.stringify(userHistory.slice(0, 5).map((b: any) => b.class_sessions?.class_types?.name)) : 'No recent workouts'}
          
          Generate a complete workout plan in this JSON format:
          {
            "workout_name": "Descriptive workout name",
            "workout_type": "strength|cardio|hiit|yoga|pilates|mixed",
            "duration_minutes": ${fitnessProfile?.available_time_minutes || 30},
            "difficulty": "beginner|intermediate|advanced",
            "exercises": [
              {
                "name": "Exercise name",
                "sets": 3,
                "reps": "10-12",
                "weight": "bodyweight|or specific weight",
                "duration_seconds": null or number,
                "rest_seconds": 60,
                "notes": "Form cues or modifications"
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
