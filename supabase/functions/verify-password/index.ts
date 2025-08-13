import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, currentPassword } = await req.json();

    if (!email || !currentPassword) {
      return new Response(
        JSON.stringify({ error: 'Email and current password are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create a temporary Supabase client to verify credentials
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Attempt to sign in with the provided credentials
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword
    });

    if (error || !data.user) {
      console.log('Password verification failed:', error?.message);
      return new Response(
        JSON.stringify({ valid: false }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Sign out immediately after verification to avoid interfering with existing session
    if (data.session) {
      await supabase.auth.signOut();
    }

    console.log('Password verification successful for user:', email);
    return new Response(
      JSON.stringify({ valid: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Password verification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})