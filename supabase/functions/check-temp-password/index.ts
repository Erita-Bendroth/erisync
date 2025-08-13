import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Checking if user has temporary password:', email)

    // Check if the provided password matches the temporary password
    const tempPassword = 'VestasTemp2025!'
    const hasTemporaryPassword = password === tempPassword

    if (hasTemporaryPassword) {
      console.log('User has temporary password, setting requires_password_change flag')
      
      // Get user ID from email
      const { data: users, error: userError } = await supabaseClient.auth.admin.listUsers()
      
      if (userError) {
        console.error('Error fetching users:', userError)
        throw userError
      }

      const user = users.users.find(u => u.email === email)
      
      if (user) {
        // Update the profile to require password change
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({ requires_password_change: true })
          .eq('user_id', user.id)

        if (updateError) {
          console.error('Error updating profile:', updateError)
          throw updateError
        }

        console.log('Successfully set requires_password_change for user:', user.id)
      }
    }

    return new Response(
      JSON.stringify({ 
        hasTemporaryPassword,
        message: hasTemporaryPassword ? 'Temporary password detected' : 'Password is not temporary'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in check-temp-password function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})