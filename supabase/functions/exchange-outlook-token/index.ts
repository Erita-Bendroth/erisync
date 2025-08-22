import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get JWT from Authorization header for security
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Missing or invalid authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { code, redirectUri } = await req.json()

    if (!code || !redirectUri) {
      throw new Error('Missing required parameters')
    }

    // Validate redirect URI to prevent open redirect attacks
    const allowedDomains = [
      'localhost',
      '127.0.0.1',
      'lovable.dev',
      '.lovable.dev'
    ];
    
    try {
      const uri = new URL(redirectUri);
      const isAllowed = allowedDomains.some(domain => 
        uri.hostname === domain || 
        (domain.startsWith('.') && uri.hostname.endsWith(domain))
      );
      
      if (!isAllowed) {
        throw new Error('Invalid redirect URI - not in allowed domains');
      }
    } catch (urlError) {
      throw new Error('Invalid redirect URI format');
    }

    // Get Azure AD app configuration from environment
    const clientId = Deno.env.get('AZURE_AD_CLIENT_ID')
    const clientSecret = Deno.env.get('AZURE_AD_CLIENT_SECRET')
    const tenantId = 'c0701940-7b3f-4116-a59f-159078bc3c63' // Vestas tenant ID

    if (!clientId || !clientSecret) {
      throw new Error('Azure AD client credentials not configured')
    }

    console.log('Exchanging code for tokens with tenant:', tenantId)

    // Exchange authorization code for access token using tenant-specific endpoint
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access User.Read'
    })

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange failed:', errorData)
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Token exchange successful')

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})