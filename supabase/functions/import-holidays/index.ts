import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema
const importHolidaysSchema = z.object({
  country_code: z.string().length(2).toUpperCase(),
  year: z.number().int().min(1900).max(2100),
  user_id: z.string().uuid().nullish(),
  region_code: z.string().max(10).nullish(), // Accept null, undefined, or string
});

// Error sanitizer
function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "Invalid input: " + error.errors.map(e => e.message).join(", ");
  }
  console.error("Internal error:", error);
  return "Operation failed. Please try again.";
}

interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties?: string[];
  launchYear?: number;
  types: string[];
}

// German regional holiday mapping
const germanRegionalHolidays: Record<string, string[]> = {
  'BW': ['Heilige Drei Könige', 'Fronleichnam', 'Allerheiligen'], // Baden-Württemberg
  'BY': ['Heilige Drei Könige', 'Fronleichnam', 'Mariä Himmelfahrt', 'Allerheiligen'], // Bavaria
  'BE': ['Internationaler Frauentag'], // Berlin
  'BB': ['Reformationstag'], // Brandenburg
  'HB': ['Reformationstag'], // Bremen
  'HH': ['Reformationstag'], // Hamburg
  'HE': ['Fronleichnam'], // Hesse
  'MV': ['Reformationstag'], // Mecklenburg-Vorpommern
  'NI': ['Reformationstag'], // Lower Saxony
  'NW': ['Fronleichnam', 'Allerheiligen'], // North Rhine-Westphalia
  'RP': ['Fronleichnam', 'Allerheiligen'], // Rhineland-Palatinate
  'SL': ['Fronleichnam', 'Mariä Himmelfahrt', 'Allerheiligen'], // Saarland
  'SN': ['Reformationstag', 'Buß- und Bettag'], // Saxony
  'ST': ['Heilige Drei Könige', 'Reformationstag'], // Saxony-Anhalt
  'SH': ['Reformationstag'], // Schleswig-Holstein
  'TH': ['Weltkindertag', 'Reformationstag'], // Thuringia
};

// UK regional holiday mapping - which regions observe each holiday
const ukHolidayRegions: Record<string, string[]> = {
  // Shared holidays observed by all regions
  "New Year's Day": ['ENG', 'SCT', 'NIR'],
  "Good Friday": ['ENG', 'SCT', 'NIR'],
  "Christmas Day": ['ENG', 'SCT', 'NIR'],
  "Boxing Day": ['ENG', 'SCT', 'NIR'],
  "Early May bank holiday": ['ENG', 'SCT', 'NIR'],
  
  // Scotland-specific
  "2 January": ['SCT'],
  "Saint Andrew's Day": ['SCT'],
  
  // Northern Ireland-specific
  "Saint Patrick's Day": ['NIR'],
  "Battle of the Boyne": ['NIR'],
  
  // England & Wales only
  "Spring bank holiday": ['ENG'],
  "Summer bank holiday": ['ENG'],
  "Easter Monday": ['ENG', 'NIR'], // NOT observed in Scotland
};

// UK regional holiday mapping (kept for backward compatibility)
const ukRegionalHolidays: Record<string, string[]> = {
  'GB-SCT': ['Saint Andrew\'s Day', '2 January'],
  'GB-NIR': ['Saint Patrick\'s Day', 'Battle of the Boyne'],
  'GB-ENG': [],
};

// UK regional holiday EXCLUSIONS - holidays that don't apply to specific regions
const ukRegionalExclusions: Record<string, string[]> = {
  'GB-SCT': ['Spring bank holiday'],
  'GB-NIR': ['Spring bank holiday', 'Summer bank holiday'],
  'GB-ENG': [],
};


// Countries to exclude non-official holidays/observances
const holidayFilters: Record<string, string[]> = {
  'SE': ['Julafton'], // Exclude Christmas Eve (not official)
  'US': ['Columbus Day'], // Example filter for US
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client with the user's token for authentication
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token or user not found' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Create Supabase client with proper auth
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

    const body = await req.json()
    const { country_code, year, user_id, region_code } = importHolidaysSchema.parse(body);
    
    console.log('Request received:', { country_code, year, user_id, region_code })

    // Check if import is already in progress for ANY region of this country/year
    const { data: existingStatus } = await supabaseClient
      .from('holiday_import_status')
      .select('*')
      .eq('country_code', country_code)
      .eq('year', year)
      .in('status', ['pending', 'in_progress'])
      .maybeSingle();

    if (existingStatus && existingStatus.status === 'pending') {
      // Check if the existing pending import is stuck (older than 15 minutes)
      const startedAt = new Date(existingStatus.started_at);
      const minutesElapsed = (new Date().getTime() - startedAt.getTime()) / (1000 * 60);
      
      if (minutesElapsed < 15) {
        return new Response(
          JSON.stringify({ 
            error: 'Import already in progress',
            status: 'pending',
            started_at: existingStatus.started_at
          }),
          { 
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      } else {
        // Auto-reset stuck import
        console.log(`⏰ Auto-resetting stuck import (${minutesElapsed.toFixed(0)} minutes old)`);
        await supabaseClient
          .from('holiday_import_status')
          .update({
            status: 'failed',
            error_message: `Import timed out after ${Math.floor(minutesElapsed)} minutes - auto-reset for retry`,
            completed_at: new Date().toISOString()
          })
          .eq('id', existingStatus.id);
      }
    }

    // Create or update import status record
    const { error: statusError } = await supabaseClient
      .from('holiday_import_status')
      .upsert({
        country_code,
        year: parseInt(year),
        region_code: region_code || null,
        status: 'pending',
        started_at: new Date().toISOString(),
        created_by: user.id,
        completed_at: null,
        error_message: null
      }, {
        onConflict: 'country_code,year,region_code'
      });

    if (statusError) {
      console.error('Error creating import status:', statusError);
    }

    console.log(`Fetching holidays for ${country_code} in ${year}`)

    let holidays: Holiday[] = []

    // Prefer authoritative source for Sweden (Riksdag calendar via dryg.net API)
    if (country_code === 'SE') {
      try {
        const seResp = await fetch(`https://api.dryg.net/dagar/v2.1/${year}`)
        if (seResp.ok) {
          const seJson = await seResp.json()
          // seJson.dagar is an array of days; map those with helgdag
          const dagar = Array.isArray(seJson?.dagar) ? seJson.dagar : []
          holidays = dagar
            .filter((d: any) => d.helgdag && d.helgdag.trim().length > 0 && d.helgdag !== 'Julafton')
            .map((d: any) => ({
              date: d.datum, // yyyy-mm-dd
              localName: d.helgdag,
              name: d.helgdag,
              countryCode: 'SE',
              fixed: false,
              global: true,
              counties: [],
              launchYear: undefined,
              types: ['Public']
            }))
        }
      } catch (e) {
        console.warn('Failed to fetch from dryg.net, falling back to Nager.Date:', e)
      }
    }

    // Fallback to Nager.Date if not Sweden or if authoritative source failed
    if (!holidays || holidays.length === 0) {
      console.log(`API URL: https://date.nager.at/api/v3/publicholidays/${year}/${country_code}`)
      const holidaysResponse = await fetch(
        `https://date.nager.at/api/v3/publicholidays/${year}/${country_code}`
      )

      if (!holidaysResponse.ok) {
        const errorText = await holidaysResponse.text()
        console.error(`Failed to fetch holidays: ${holidaysResponse.status} - ${holidaysResponse.statusText}`)
        console.error(`Response body: ${errorText}`)
        throw new Error(`Failed to fetch holidays: ${holidaysResponse.statusText} (${holidaysResponse.status})`)
      }

      holidays = await holidaysResponse.json()
    }
    console.log(`Found ${holidays.length} holidays`)
    console.log(`Sample holidays:`, holidays.slice(0, 2))

    if (holidays.length === 0) {
      console.log(`No holidays found for ${country_code} in ${year}`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          imported: 0,
          message: `No holidays available for ${country_code} in ${year}. This might be normal - some countries don't have all years available in the API.`,
          holidays: [] 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Filter holidays to include ONLY official public holidays and exclude observances
    const countryFilters = holidayFilters[country_code] || [];
    const filteredHolidays = holidays.filter(holiday => {
      const holidayName = holiday.localName || holiday.name;
      
      // Exclude country-specific unofficial holidays
      if (countryFilters.some(filter => holidayName.includes(filter))) return false;
      
      // UK-specific: exclude holidays that don't apply to specified region
      if (country_code === 'GB' && region_code) {
        const regionExclusions = ukRegionalExclusions[`GB-${region_code}`] || [];
        if (regionExclusions.some(excluded => holidayName.includes(excluded))) {
          return false; // This holiday doesn't apply to this UK region
        }
      }
      
      // Only accept official public holidays
      return holiday.types && holiday.types.includes('Public');
    });

    // Prepare holiday data for database
    const holidayData = filteredHolidays.flatMap(holiday => {
      let regionalCode: string | null = null;
      const matchingGermanRegions: string[] = [];
      const matchingUKRegions: string[] = [];

      // Generic regional mapping: if API provides counties codes like "DE-BY"
      if (region_code && Array.isArray(holiday.counties) && holiday.counties.length > 0) {
        const target = `${country_code}-${region_code}`;
        if (holiday.counties.includes(target)) {
          regionalCode = region_code;
        }
      }

        // German regional holiday mapping - use API's counties field for accuracy
        if (country_code === 'DE' && region_code) {
          const requestedRegion = `DE-${region_code.replace('DE-', '')}`;
          
          // Check if the holiday has a counties field from the API
          if (holiday.counties && Array.isArray(holiday.counties)) {
            // Only include this holiday if the requested region is in the counties list
            if (holiday.counties.includes(requestedRegion)) {
              console.log(`✅ ${holiday.name} applies to ${requestedRegion} - in counties:`, holiday.counties);
              matchingGermanRegions.push(region_code.replace('DE-', ''));
            } else {
              console.log(`❌ Skipping ${holiday.name} for ${requestedRegion} - not in counties:`, holiday.counties);
              // Skip this holiday - doesn't apply to this region
            }
          } else {
            // No counties field = national holiday, include it for this region
            console.log(`ℹ️ ${holiday.name} has no counties field - national holiday, creating for ${requestedRegion}`);
            matchingGermanRegions.push(region_code.replace('DE-', ''));
          }
        }

      // UK regional holiday mapping - use API's counties field for accuracy
      if (country_code === 'GB' && region_code) {
        const requestedRegion = `GB-${region_code.replace('GB-', '')}`;
        
        // Check if the holiday has a counties field from the API
        if (holiday.counties && Array.isArray(holiday.counties)) {
          // Only include this holiday if the requested region is in the counties list
          if (holiday.counties.includes(requestedRegion)) {
            console.log(`✅ ${holiday.name} applies to ${requestedRegion} - in counties:`, holiday.counties);
            matchingUKRegions.push(region_code.replace('GB-', ''));
          } else {
            console.log(`❌ Skipping ${holiday.name} for ${requestedRegion} - not in counties:`, holiday.counties);
            // Skip this holiday - doesn't apply to this region
          }
        } else {
          // No counties field = national holiday, include it for this region
          console.log(`ℹ️ ${holiday.name} has no counties field - national holiday, creating for ${requestedRegion}`);
          matchingUKRegions.push(region_code.replace('GB-', ''));
        }
      }

        // For German holidays - ONLY create entries if they apply to the requested region
        if (country_code === 'DE' && region_code) {
          // If we checked for this region and it didn't match, skip it entirely
          if (matchingGermanRegions.length === 0) {
            return []; // Skip this holiday - doesn't apply to requested region
          }
          
          // Create entry for the matching region
          return matchingGermanRegions.map(region => ({
            name: holiday.localName || holiday.name,
            date: holiday.date,
            country_code: holiday.countryCode,
            year: parseInt(year),
            is_public: true,
            user_id: null,
            region_code: region
          }));
        }
      
      // For UK holidays - ONLY create entries if they apply to the requested region
      if (country_code === 'GB' && region_code) {
        // If we checked for this region and it didn't match, skip it entirely
        if (matchingUKRegions.length === 0) {
          return []; // Skip this holiday - doesn't apply to requested region
        }
        
        // Create entry for the matching region
        return matchingUKRegions.map(region => ({
          name: holiday.localName || holiday.name,
          date: holiday.date,
          country_code: holiday.countryCode,
          year: parseInt(year),
          is_public: true,
          user_id: null,
          region_code: region
        }));
      }
      
      // For all other holidays (national or single region), return single row
      return [{
        name: holiday.localName || holiday.name,
        date: holiday.date,
        country_code: holiday.countryCode,
        year: parseInt(year),
        is_public: true,
        user_id: null,
        region_code: regionalCode
      }];
    })

    console.log('Prepared holiday data sample:', holidayData.slice(0, 2))

    // Use upsert with ignoreDuplicates for faster operation - single DB call
    // Note: The unique constraint is on (date, country_code, year, region_code) for public holidays
    console.log('Upserting holidays into database...')
    const { error } = await supabaseClient
      .from('holidays')
      .upsert(holidayData, { 
        onConflict: 'date,country_code,year,region_code',
        ignoreDuplicates: true
      })

    if (error) {
      console.error('Database error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw new Error(`Database error: ${error.message} (${error.code})`)
    }

    console.log(`Successfully upserted holidays for ${country_code} ${year}`)

    // ============================================
    // AUTO-CLEANUP: Remove conflicting schedule entries
    // Only cleans up entries that were created with skip_holidays=true
    // This handles the case where holidays were imported AFTER schedules were created
    // ============================================
    const holidayDates = holidayData.map(h => h.date);
    let cleanedUpCount = 0;
    let cleanedUpVacationCount = 0;

    if (holidayDates.length > 0) {
      console.log(`🧹 Starting auto-cleanup for ${holidayDates.length} holiday dates...`);

      // Find users in this country/region
      let usersQuery = supabaseClient
        .from('profiles')
        .select('user_id')
        .eq('country_code', country_code);
      
      if (region_code) {
        usersQuery = usersQuery.eq('region_code', region_code);
      }

      const { data: matchingUsers, error: usersError } = await usersQuery;

      if (usersError) {
        console.error('❌ Error fetching users for cleanup:', usersError);
      } else if (matchingUsers && matchingUsers.length > 0) {
        const userIds = matchingUsers.map(u => u.user_id);
        console.log(`   Found ${userIds.length} users in ${country_code}/${region_code || 'all regions'}`);

        // Delete work and vacation schedule entries that:
        // 1. Fall on holiday dates
        // 2. Belong to users in this country/region
        // 3. Have metadata.skip_holidays = true (were created with "skip holidays" option)
        const { data: deletedEntries, error: cleanupError } = await supabaseClient
          .from('schedule_entries')
          .delete()
          .in('date', holidayDates)
          .in('user_id', userIds)
          .in('activity_type', ['work', 'vacation'])
          .eq('metadata->>skip_holidays', 'true')
          .select('id, user_id, date, activity_type, team_id');

        if (cleanupError) {
          console.warn('⚠️ Failed to clean up schedule entries:', cleanupError);
        } else if (deletedEntries && deletedEntries.length > 0) {
          cleanedUpCount = deletedEntries.filter(e => e.activity_type === 'work').length;
          cleanedUpVacationCount = deletedEntries.filter(e => e.activity_type === 'vacation').length;
          
          console.log(`✅ Cleaned up ${cleanedUpCount} work entries and ${cleanedUpVacationCount} vacation entries on holiday dates`);

          // Handle vacation_requests for deleted vacation entries
          if (cleanedUpVacationCount > 0) {
            const vacationEntries = deletedEntries.filter(e => e.activity_type === 'vacation');
            
            for (const entry of vacationEntries) {
              // Find and update the corresponding vacation_request
              const { error: vacationUpdateError } = await supabaseClient
                .from('vacation_requests')
                .update({
                  status: 'rejected',
                  rejection_reason: `Vacation day falls on public holiday - automatically removed`,
                  rejected_at: new Date().toISOString()
                })
                .eq('user_id', entry.user_id)
                .eq('requested_date', entry.date)
                .eq('status', 'approved');

              if (vacationUpdateError) {
                console.warn(`⚠️ Failed to update vacation_request for ${entry.user_id} on ${entry.date}:`, vacationUpdateError);
              }
            }
          }

          // Log cleanup to schedule_change_log for audit trail
          const changeLogEntries = deletedEntries.map(entry => ({
            schedule_entry_id: null, // Entry was deleted
            user_id: entry.user_id,
            team_id: entry.team_id,
            change_type: 'holiday_auto_cleanup',
            changed_by: user.id,
            old_values: { 
              date: entry.date, 
              activity_type: entry.activity_type,
              reason: `Auto-removed: ${country_code} holiday imported` 
            },
            new_values: null
          }));

          const { error: logError } = await supabaseClient
            .from('schedule_change_log')
            .insert(changeLogEntries);

          if (logError) {
            console.warn('⚠️ Failed to log schedule changes:', logError);
          }

          // Create notifications for affected users
          const affectedUserIds = [...new Set(deletedEntries.map(e => e.user_id))];
          const notifications = affectedUserIds.map(userId => ({
            user_id: userId,
            type: 'schedule_change',
            title: 'Schedule Updated',
            message: `Some of your schedule entries were automatically removed because they fall on public holidays in your location.`,
            link: '/schedule',
            metadata: { 
              cleanup_reason: 'holiday_import',
              country_code,
              region_code 
            }
          }));

          const { error: notifyError } = await supabaseClient
            .from('notifications')
            .insert(notifications);

          if (notifyError) {
            console.warn('⚠️ Failed to create notifications:', notifyError);
          } else {
            console.log(`📬 Notified ${affectedUserIds.length} users about schedule cleanup`);
          }
        } else {
          console.log('ℹ️ No conflicting schedule entries found to clean up');
        }
      } else {
        console.log(`ℹ️ No users found in ${country_code}/${region_code || 'all regions'} - skipping cleanup`);
      }
    }

    // Update status to completed immediately - handle NULL region_code correctly
    console.log(`📊 Updating import status for ${country_code} ${year} ${region_code || '(no region)'}`);
    console.log(`   - Imported count: ${holidayData.length}`);
    console.log(`   - Cleaned up: ${cleanedUpCount} work entries, ${cleanedUpVacationCount} vacation entries`);
    
    const statusUpdate = region_code 
      ? supabaseClient
          .from('holiday_import_status')
          .update({
            status: 'completed',
            imported_count: holidayData.length,
            completed_at: new Date().toISOString()
          })
          .eq('country_code', country_code)
          .eq('year', year)
          .eq('region_code', region_code)
      : supabaseClient
          .from('holiday_import_status')
          .update({
            status: 'completed',
            imported_count: holidayData.length,
            completed_at: new Date().toISOString()
          })
          .eq('country_code', country_code)
          .eq('year', year)
          .is('region_code', null);
    
    const { error: statusUpdateError } = await statusUpdate;
    
    if (statusUpdateError) {
      console.error('❌ Failed to update import status:', statusUpdateError);
      console.error('   Query params:', { country_code, year, region_code });
    } else {
      console.log('✅ Import status updated to completed');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: holidayData.length,
        cleaned_up: cleanedUpCount + cleanedUpVacationCount,
        cleaned_up_work: cleanedUpCount,
        cleaned_up_vacation: cleanedUpVacationCount,
        message: `Holidays upserted successfully for ${country_code} ${year}${cleanedUpCount + cleanedUpVacationCount > 0 ? `. Cleaned up ${cleanedUpCount + cleanedUpVacationCount} conflicting schedule entries.` : ''}`,
        total: holidayData.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const sanitized = sanitizeError(error);
    console.error('Error importing holidays:', error)
    
    // Update import status to failed
    try {
      const requestBody = await req.clone().json();
      const { error: failStatusError } = await supabaseClient
        .from('holiday_import_status')
        .update({
          status: 'failed',
          error_message: 'Import failed',
          completed_at: new Date().toISOString()
        })
        .eq('country_code', requestBody.country_code)
        .eq('year', requestBody.year)
        .eq('region_code', requestBody.region_code || null);
      
      if (failStatusError) {
        console.error('Failed to update error status:', failStatusError);
      } else {
        console.log('❌ Import status updated to failed');
      }
    } catch (updateError) {
      console.error('Error updating import status:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: sanitized }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})