import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecommendationRequest {
  type: 'class_recommendations' | 'fitness_tips' | 'schedule_optimization';
  userId?: string;
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
    const { type, userId, preferences }: RecommendationRequest = await req.json();
    console.log(`Processing AI recommendation type: ${type}`);

    // Get user's booking history if userId provided
    let userHistory = null;
    if (userId) {
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
    }

    // Get available class types
    const { data: classTypes } = await supabase
      .from('class_types')
      .select('*')
      .eq('is_active', true);

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

    console.log("AI recommendation generated successfully");

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
