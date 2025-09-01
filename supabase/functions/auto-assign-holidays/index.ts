import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get all users with their location preferences
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('user_id, country_code, region_code')
      .not('country_code', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw new Error(`Failed to fetch user profiles: ${profilesError.message}`);
    }

    console.log(`Processing ${profiles?.length || 0} user profiles for holiday assignment`);

    let totalAssigned = 0;

    // For each user, find their holidays and auto-assign to schedule
    for (const profile of profiles || []) {
      const { user_id, country_code, region_code } = profile;

      // Get holidays for this user's location
      let holidayQuery = supabaseClient
        .from('holidays')
        .select('date, name')
        .eq('country_code', country_code)
        .eq('is_public', true)
        .gte('date', new Date().toISOString().split('T')[0]); // Only future holidays

      // For Germany, include both national and regional holidays
      if (country_code === 'DE' && region_code) {
        holidayQuery = holidayQuery.or(`region_code.is.null,region_code.eq.${region_code}`);
      } else {
        holidayQuery = holidayQuery.is('region_code', null);
      }

      const { data: holidays, error: holidaysError } = await holidayQuery;

      if (holidaysError) {
        console.error(`Error fetching holidays for user ${user_id}:`, holidaysError);
        continue;
      }

      if (!holidays || holidays.length === 0) {
        console.log(`No holidays found for user ${user_id} in ${country_code}`);
        continue;
      }

      // Check which holidays are not already in the schedule
      for (const holiday of holidays) {
        // Fetch user's teams
        const { data: teams } = await supabaseClient
          .from('team_members')
          .select('team_id')
          .eq('user_id', user_id);

        const teamIds = (teams || []).map(t => t.team_id);
        if (teamIds.length === 0) {
          console.log(`User ${user_id} has no teams; skipping team-based assignment for ${holiday.date}`);
          continue;
        }

        // Create an entry per team if missing
        for (const teamId of teamIds) {
          const { data: existingEntry } = await supabaseClient
            .from('schedule_entries')
            .select('id')
            .eq('user_id', user_id)
            .eq('team_id', teamId)
            .eq('date', holiday.date)
            .maybeSingle();

          if (!existingEntry) {
            // Auto-assign holiday to schedule as unavailable
            const { error: insertError } = await supabaseClient
              .from('schedule_entries')
              .insert({
                user_id: user_id,
                team_id: teamId,
                date: holiday.date,
                shift_type: 'normal',
                activity_type: 'sick',
                availability_status: 'unavailable',
                notes: `Public holiday: ${holiday.name}`,
                created_by: user_id
              });

            if (insertError) {
              console.error(`Error inserting holiday for user ${user_id} team ${teamId}:`, insertError);
            } else {
              totalAssigned++;
              console.log(`Assigned holiday ${holiday.name} to user ${user_id} (team ${teamId}) on ${holiday.date}`);
            }
          }
        }
      }
    }

    console.log(`Successfully auto-assigned ${totalAssigned} holiday entries`);

    return new Response(
      JSON.stringify({ 
        success: true,
        assigned: totalAssigned,
        message: `Auto-assigned ${totalAssigned} holiday entries to user schedules`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in auto-assign-holidays:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})