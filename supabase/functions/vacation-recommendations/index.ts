import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { teamIds, userId, dateRange } = await req.json();

    // Fetch capacity data
    const { data: capacityConfig } = await supabase
      .from('team_capacity_config')
      .select('*')
      .in('team_id', teamIds);

    // Fetch existing vacation requests
    const { data: existingRequests } = await supabase
      .from('vacation_requests')
      .select('*')
      .in('team_id', teamIds)
      .gte('requested_date', dateRange.start)
      .lte('requested_date', dateRange.end);

    // Fetch user's vacation history
    const { data: userHistory } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'approved');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Analyze vacation patterns and recommend optimal dates for vacation requests.

Context:
- Team capacity requirements: ${JSON.stringify(capacityConfig)}
- Existing vacation requests: ${existingRequests?.length || 0} requests in date range
- User's vacation history: ${userHistory?.length || 0} previous vacations
- Date range: ${dateRange.start} to ${dateRange.end}

Provide 3-5 recommended vacation windows considering:
1. Team capacity availability
2. Fair distribution (avoid overloading certain periods)
3. Avoid conflicts with existing requests
4. Consider user's previous vacation patterns

For each recommendation, provide:
- Start and end dates
- Reason for recommendation
- Confidence score (0-100)
- Potential conflicts or considerations`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a workforce planning assistant. Analyze vacation patterns and provide data-driven recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_vacation_windows',
              description: 'Return 3-5 recommended vacation windows',
              parameters: {
                type: 'object',
                properties: {
                  recommendations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        start_date: { type: 'string', description: 'ISO date format' },
                        end_date: { type: 'string', description: 'ISO date format' },
                        reason: { type: 'string' },
                        confidence: { type: 'number', minimum: 0, maximum: 100 },
                        considerations: { type: 'string' }
                      },
                      required: ['start_date', 'end_date', 'reason', 'confidence'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['recommendations'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_vacation_windows' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`AI Gateway error: ${errorText}`);
    }

    const result = await aiResponse.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No recommendations generated');
    }

    const recommendations = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in vacation-recommendations:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
