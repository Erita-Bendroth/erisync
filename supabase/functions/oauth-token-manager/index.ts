import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  'https://erisync.lovable.app',
  'https://erisync.xyz'
];

const isOriginAllowed = (origin: string | null): boolean => {
  if (!origin) return false;
  
  // Check exact matches
  if (allowedOrigins.includes(origin)) return true;
  
  // Check for Lovable preview domains (*.lovableproject.com)
  if (origin.endsWith('.lovableproject.com')) return true;
  
  return false;
};

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = isOriginAllowed(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
  };
};

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { method } = req;
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const provider = pathParts[pathParts.length - 1]; // Extract provider from URL

    if (method === 'POST') {
      // Store or update OAuth tokens
      const body = await req.json();
      const { access_token, refresh_token, expires_at, scope } = body;

      if (!access_token) {
        return new Response(JSON.stringify({ error: 'access_token is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('user_oauth_tokens')
        .upsert({
          user_id: user.user.id,
          provider,
          access_token,
          refresh_token,
          expires_at: expires_at ? new Date(expires_at).toISOString() : null,
          scope,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,provider'
        });

      if (error) {
        console.error('Error storing tokens:', error);
        return new Response(JSON.stringify({ error: 'Failed to store tokens' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (method === 'GET') {
      // Retrieve OAuth tokens (only returns existence, not the actual tokens)
      const { data, error } = await supabase
        .from('user_oauth_tokens')
        .select('provider, expires_at, scope, created_at')
        .eq('user_id', user.user.id)
        .eq('provider', provider)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error retrieving token info:', error);
        return new Response(JSON.stringify({ error: 'Failed to retrieve token info' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        exists: !!data,
        expires_at: data?.expires_at,
        scope: data?.scope,
        created_at: data?.created_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (method === 'DELETE') {
      // Delete OAuth tokens
      const { error } = await supabase
        .from('user_oauth_tokens')
        .delete()
        .eq('user_id', user.user.id)
        .eq('provider', provider);

      if (error) {
        console.error('Error deleting tokens:', error);
        return new Response(JSON.stringify({ error: 'Failed to delete tokens' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('OAuth token manager error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});