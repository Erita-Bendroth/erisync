import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { country_code, year, user_id, region_code } = await req.json()
    console.log('Request received:', { country_code, year, user_id, region_code })

    if (!country_code || !year) {
      console.error('Missing required parameters:', { country_code, year, user_id })
      return new Response(
        JSON.stringify({ error: 'Country code and year are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
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

    // Check for existing holidays first
    console.log('Checking for existing holidays...')
    let existingQuery = supabaseClient
      .from('holidays')
      .select('date, region_code')
      .eq('country_code', country_code)
      .eq('year', year)
      .is('user_id', null); // Check centrally managed holidays
    
    const { data: existingHolidays, error: checkError } = await existingQuery;

    if (checkError) {
      console.error('Error checking existing holidays:', checkError)
      throw new Error(`Database error: ${checkError.message}`)
    }

    // Create a set of existing holiday keys (date + region_code combination)
    const existingKeys = new Set(existingHolidays?.map(h => `${h.date}-${h.region_code || 'national'}`) || [])
    const newHolidays = holidayData.filter(holiday => {
      const key = `${holiday.date}-${holiday.region_code || 'national'}`;
      return !existingKeys.has(key);
    });

    console.log(`Found ${existingHolidays?.length || 0} existing holidays, ${newHolidays.length} new holidays to insert`)

    if (newHolidays.length === 0) {
      console.log('All holidays already exist')
      return new Response(
        JSON.stringify({
          success: true,
          message: `All holidays for ${country_code} ${year} already exist`,
          imported: 0,
          existing: existingHolidays?.length || 0,
          total: holidayData.length
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Insert only new holidays
    console.log('Inserting new holidays into database...')
    const { data, error } = await supabaseClient
      .from('holidays')
      .insert(newHolidays)

    console.log('Insert result:', { 
      success: !error, 
      error: error ? { code: error.code, message: error.message, details: error.details } : null,
      insertedCount: data?.length || 0 
    });

    if (error) {
      console.error('Database error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw new Error(`Database error: ${error.message} (${error.code})`)
    }

    console.log(`Successfully imported ${newHolidays.length} holidays`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: newHolidays.length,
        existing: existingHolidays?.length || 0,
        total: holidayData.length,
        holidays: newHolidays 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error importing holidays:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})