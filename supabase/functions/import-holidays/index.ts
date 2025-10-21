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
  user_id: z.string().uuid().optional(),
  region_code: z.string().max(10).optional(),
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

// Countries to exclude non-official holidays/observances
const holidayFilters: Record<string, string[]> = {
  'SE': ['Julafton'], // Exclude Christmas Eve (not official)
  'US': ['Columbus Day'], // Example filter for US
  'GB': ['Boxing Day'] // Example filter for UK
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

    // Check if import is already in progress
    const { data: existingStatus } = await supabaseClient
      .from('holiday_import_status')
      .select('*')
      .eq('country_code', country_code)
      .eq('year', year)
      .eq('region_code', region_code || null)
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
      // Only accept official public holidays
      return holiday.types && holiday.types.includes('Public');
    });

    // Prepare holiday data for database
    const holidayData = filteredHolidays.map(holiday => {
      let regionalCode: string | null = null;

      // Generic regional mapping: if API provides counties codes like "DE-BY"
      if (region_code && Array.isArray(holiday.counties) && holiday.counties.length > 0) {
        const target = `${country_code}-${region_code}`;
        if (holiday.counties.includes(target)) {
          regionalCode = region_code;
        }
      }

      // Additional German safety net by name mapping
      if (!regionalCode && country_code === 'DE' && region_code) {
        const holidayName = holiday.localName || holiday.name;
        const regionalHolidays = germanRegionalHolidays[region_code] || [];
        if (regionalHolidays.some(regional => holidayName.includes(regional))) {
          regionalCode = region_code;
        }
      }
      
      return {
        name: holiday.localName || holiday.name,
        date: holiday.date,
        country_code: holiday.countryCode,
        year: parseInt(year),
        is_public: true,
        user_id: null, // Always null for centrally managed holidays
        region_code: regionalCode
      };
    })

    console.log('Prepared holiday data sample:', holidayData.slice(0, 2))

    // Use upsert with ignoreDuplicates for faster operation - single DB call
    console.log('Upserting holidays into database...')
    const { error } = await supabaseClient
      .from('holidays')
      .upsert(holidayData, { 
        onConflict: 'date,country_code,region_code,user_id',
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

    // Update status to completed immediately
    const { error: statusUpdateError } = await supabaseClient
      .from('holiday_import_status')
      .update({
        status: 'completed',
        imported_count: holidayData.length,
        completed_at: new Date().toISOString()
      })
      .eq('country_code', country_code)
      .eq('year', year)
      .eq('region_code', region_code || null);
    
    if (statusUpdateError) {
      console.error('Failed to update import status:', statusUpdateError);
    } else {
      console.log('✅ Import status updated to completed');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: holidayData.length,
        message: `Holidays upserted successfully for ${country_code} ${year}`,
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