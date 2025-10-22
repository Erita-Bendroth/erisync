import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsRequest {
  team_ids: string[];
  start_date: string;
  end_date: string;
  metrics?: string[]; // ['capacity', 'efficiency', 'coverage', 'vacation']
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify authentication
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { team_ids, start_date, end_date, metrics = ['capacity', 'efficiency', 'coverage', 'vacation'] }: AnalyticsRequest =
      await req.json();

    console.log('Calculating analytics for teams:', team_ids, 'from', start_date, 'to', end_date);

    const results: any = {
      calculated_at: new Date().toISOString(),
      team_ids,
      start_date,
      end_date,
      metrics: {},
    };

    // Calculate capacity metrics for each team
    if (metrics.includes('capacity')) {
      const capacityPromises = team_ids.map(async (team_id) => {
        const { data, error } = await supabaseClient.rpc('get_team_capacity_metrics', {
          _team_id: team_id,
          _start_date: start_date,
          _end_date: end_date,
        });

        if (error) {
          console.error('Error calculating capacity for team', team_id, error);
          return null;
        }

        // Store snapshot
        await supabaseClient.from('analytics_snapshots').insert({
          snapshot_date: new Date().toISOString().split('T')[0],
          team_id,
          metric_type: 'capacity',
          metric_data: data,
        });

        return { team_id, data };
      });

      results.metrics.capacity = await Promise.all(capacityPromises);
    }

    // Calculate efficiency metrics
    if (metrics.includes('efficiency')) {
      const { data: efficiencyData, error: efficiencyError } = await supabaseClient.rpc(
        'get_scheduling_efficiency',
        {
          _team_ids: team_ids,
          _start_date: start_date,
          _end_date: end_date,
        }
      );

      if (!efficiencyError && efficiencyData) {
        results.metrics.efficiency = efficiencyData;

        // Store snapshot for each team
        for (const team_id of team_ids) {
          await supabaseClient.from('analytics_snapshots').insert({
            snapshot_date: new Date().toISOString().split('T')[0],
            team_id,
            metric_type: 'distribution',
            metric_data: efficiencyData,
          });
        }
      }
    }

    // Calculate coverage gaps for each team
    if (metrics.includes('coverage')) {
      const coveragePromises = team_ids.map(async (team_id) => {
        // Don't pass _min_coverage, let the function use team config
        const { data, error } = await supabaseClient.rpc('identify_coverage_gaps', {
          _team_id: team_id,
          _start_date: start_date,
          _end_date: end_date,
        });

        if (error) {
          console.error('Error calculating coverage for team', team_id, error);
          return null;
        }

        // Store snapshot
        await supabaseClient.from('analytics_snapshots').insert({
          snapshot_date: new Date().toISOString().split('T')[0],
          team_id,
          metric_type: 'coverage',
          metric_data: data,
        });

        return { team_id, data };
      });

      results.metrics.coverage = await Promise.all(coveragePromises);
    }

    // Analyze vacation patterns for each team
    if (metrics.includes('vacation')) {
      const vacationPromises = team_ids.map(async (team_id) => {
        const { data, error } = await supabaseClient.rpc('analyze_vacation_patterns', {
          _team_id: team_id,
          _lookback_months: 6,
        });

        if (error) {
          console.error('Error analyzing vacation patterns for team', team_id, error);
          return null;
        }

        return { team_id, data };
      });

      results.metrics.vacation = await Promise.all(vacationPromises);
    }

    console.log('Analytics calculation complete');

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in calculate-analytics:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
