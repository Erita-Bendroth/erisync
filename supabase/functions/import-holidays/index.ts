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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { country_code, year, user_id } = await req.json()
    console.log('Request received:', { country_code, year, user_id })

    if (!country_code || !year || !user_id) {
      console.error('Missing required parameters:', { country_code, year, user_id })
      return new Response(
        JSON.stringify({ error: 'Country code, year, and user_id are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Fetching holidays for ${country_code} in ${year}`)
    console.log(`API URL: https://date.nager.at/api/v3/publicholidays/${year}/${country_code}`)

    // Fetch holidays from public API (nager.date is free and reliable)
    const holidaysResponse = await fetch(
      `https://date.nager.at/api/v3/publicholidays/${year}/${country_code}`
    )

    if (!holidaysResponse.ok) {
      const errorText = await holidaysResponse.text()
      console.error(`Failed to fetch holidays: ${holidaysResponse.status} - ${holidaysResponse.statusText}`)
      console.error(`Response body: ${errorText}`)
      throw new Error(`Failed to fetch holidays: ${holidaysResponse.statusText} (${holidaysResponse.status})`)
    }

    const holidays: Holiday[] = await holidaysResponse.json()
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

    // Insert holidays into database
    const holidayData = holidays.map(holiday => ({
      name: holiday.localName || holiday.name,
      date: holiday.date,
      country_code: holiday.countryCode,
      year: parseInt(year),
      is_public: holiday.global || holiday.types.includes('Public'),
      user_id: user_id
    }))

    console.log('Prepared holiday data sample:', holidayData.slice(0, 2))

    // First try a simple insert without upsert to test RLS
    const { data, error } = await supabaseClient
      .from('holidays')
      .insert(holidayData)

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

    console.log(`Successfully imported ${holidayData.length} holidays`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: holidayData.length,
        holidays: holidayData 
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