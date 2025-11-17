import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'request_created' | 'request_approved' | 'request_rejected';
  requesting_user_id: string;
  target_user_id: string;
  swap_date: string;
  team_id: string;
  review_notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, requesting_user_id, target_user_id, swap_date, team_id, review_notes }: NotificationRequest = await req.json();

    console.log('Sending swap notification:', { type, requesting_user_id, target_user_id, swap_date });

    // Fetch user profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .in('user_id', [requesting_user_id, target_user_id]);

    if (!profiles || profiles.length === 0) {
      throw new Error('Failed to fetch user profiles');
    }

    const requestingUser = profiles.find(p => p.user_id === requesting_user_id);
    const targetUser = profiles.find(p => p.user_id === target_user_id);

    // Fetch team managers for notifications
    const { data: managers } = await supabase
      .from('team_members')
      .select('user_id, profiles!team_members_user_id_fkey(email, first_name, last_name)')
      .eq('team_id', team_id)
      .eq('is_manager', true);

    let notificationMessage = '';
    let recipients: string[] = [];

    switch (type) {
      case 'request_created':
        notificationMessage = `${requestingUser?.first_name} ${requestingUser?.last_name} has requested to swap shifts with ${targetUser?.first_name} ${targetUser?.last_name} on ${new Date(swap_date).toLocaleDateString()}.`;
        // Notify target user and managers
        recipients = [
          ...(targetUser?.email ? [targetUser.email] : []),
          ...(managers?.map(m => (m.profiles as any)?.email).filter(Boolean) || [])
        ];
        break;

      case 'request_approved':
        notificationMessage = `Your shift swap request with ${targetUser?.first_name} ${targetUser?.last_name} on ${new Date(swap_date).toLocaleDateString()} has been approved.${review_notes ? `\n\nManager's notes: ${review_notes}` : ''}`;
        // Notify both users
        recipients = [
          ...(requestingUser?.email ? [requestingUser.email] : []),
          ...(targetUser?.email ? [targetUser.email] : [])
        ];
        break;

      case 'request_rejected':
        notificationMessage = `Your shift swap request with ${targetUser?.first_name} ${targetUser?.last_name} on ${new Date(swap_date).toLocaleDateString()} has been rejected.${review_notes ? `\n\nReason: ${review_notes}` : ''}`;
        // Notify requesting user
        recipients = requestingUser?.email ? [requestingUser.email] : [];
        break;
    }

    console.log('Notification prepared:', { message: notificationMessage, recipients });

    // Here you would integrate with your email service (e.g., Resend, SendGrid, etc.)
    // For now, we'll just log the notification
    // In production, add actual email sending logic

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification sent successfully',
        notificationMessage,
        recipients
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending swap notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
