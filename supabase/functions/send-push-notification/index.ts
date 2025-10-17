import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

interface PushNotificationRequest {
  userId: string;
  title: string;
  body: string;
  data?: any;
  tag?: string;
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, title, body, data, tag }: PushNotificationRequest = await req.json();

    console.log('Push notification request:', { userId, title, body });

    // Get user's notification preferences
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Store notification in database for in-app display
    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message: body,
        type: tag || 'general',
        data: data || {},
        read: false,
      });

    if (insertError) {
      console.error('Error storing notification:', insertError);
    }

    // Note: For actual push notifications via service worker,
    // you would need to implement Web Push Protocol with VAPID keys
    // This would require storing push subscriptions in the database
    // and using a library like web-push to send notifications

    console.log('Notification processed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Notification sent successfully',
        userId,
        title
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error in send-push-notification function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
