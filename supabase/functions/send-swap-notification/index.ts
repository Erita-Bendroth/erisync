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

    // Fetch schedule entries to check if cross-team
    const { data: swapRequest } = await supabase
      .from('shift_swap_requests')
      .select(`
        requesting_entry:schedule_entries!shift_swap_requests_requesting_entry_id_fkey(team_id, teams(name)),
        target_entry:schedule_entries!shift_swap_requests_target_entry_id_fkey(team_id, teams(name))
      `)
      .eq('requesting_user_id', requesting_user_id)
      .eq('target_user_id', target_user_id)
      .eq('swap_date', swap_date)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const isCrossTeam = swapRequest?.requesting_entry?.team_id !== swapRequest?.target_entry?.team_id;

    // Fetch managers from both teams if cross-team
    const teamsToCheck = isCrossTeam 
      ? [swapRequest?.requesting_entry?.team_id, swapRequest?.target_entry?.team_id].filter(Boolean)
      : [team_id];

    const { data: managers } = await supabase
      .from('team_members')
      .select('user_id, profiles!team_members_user_id_fkey(email, first_name, last_name)')
      .in('team_id', teamsToCheck)
      .eq('is_manager', true);

    let notificationMessage = '';
    let recipients: string[] = [];

    switch (type) {
      case 'request_created':
        const teamContext = isCrossTeam 
          ? ` (Cross-team: ${swapRequest?.requesting_entry?.teams?.name} ↔ ${swapRequest?.target_entry?.teams?.name})`
          : '';
        notificationMessage = `${requestingUser?.first_name} ${requestingUser?.last_name} has requested to swap shifts with ${targetUser?.first_name} ${targetUser?.last_name} on ${new Date(swap_date).toLocaleDateString()}${teamContext}.`;
        // Notify target user and managers from both teams
        recipients = [
          ...(targetUser?.email ? [targetUser.email] : []),
          ...(managers?.map(m => (m.profiles as any)?.email).filter(Boolean) || [])
        ];

        // Create in-app notifications
        const notificationsToCreate = [];
        
        // Notify target user
        if (target_user_id) {
          notificationsToCreate.push({
            user_id: target_user_id,
            type: 'swap_request',
            title: 'New Shift Swap Request',
            message: `${requestingUser?.first_name} ${requestingUser?.last_name} wants to swap shifts with you on ${new Date(swap_date).toLocaleDateString()}`,
            link: `/schedule?tab=schedule&showRequests=true`,
            metadata: { swap_date, team_id, requesting_user_id }
          });
        }

        // Notify managers
        if (managers && managers.length > 0) {
          managers.forEach(m => {
            notificationsToCreate.push({
              user_id: m.user_id,
              type: 'swap_request',
              title: 'Shift Swap Request',
              message: notificationMessage,
              link: `/schedule?tab=schedule`,
              metadata: { swap_date, team_id }
            });
          });
        }

        if (notificationsToCreate.length > 0) {
          await supabase.from('notifications').insert(notificationsToCreate);
        }
        break;

      case 'request_approved':
        notificationMessage = `Your shift swap request with ${targetUser?.first_name} ${targetUser?.last_name} on ${new Date(swap_date).toLocaleDateString()} has been approved.${review_notes ? `\n\nManager's notes: ${review_notes}` : ''}`;
        // Notify both users
        recipients = [
          ...(requestingUser?.email ? [requestingUser.email] : []),
          ...(targetUser?.email ? [targetUser.email] : [])
        ];

        // Create in-app notifications for both users
        await supabase.from('notifications').insert([
          {
            user_id: requesting_user_id,
            type: 'approval',
            title: 'Shift Swap Approved',
            message: `Your shift swap with ${targetUser?.first_name} on ${new Date(swap_date).toLocaleDateString()} has been approved`,
            link: `/schedule?tab=schedule`,
            metadata: { swap_date }
          },
          {
            user_id: target_user_id,
            type: 'approval',
            title: 'Shift Swap Approved',
            message: `Your shift swap with ${requestingUser?.first_name} on ${new Date(swap_date).toLocaleDateString()} has been approved`,
            link: `/schedule?tab=schedule`,
            metadata: { swap_date }
          }
        ]);
        break;

      case 'request_rejected':
        notificationMessage = `Your shift swap request with ${targetUser?.first_name} ${targetUser?.last_name} on ${new Date(swap_date).toLocaleDateString()} has been rejected.${review_notes ? `\n\nReason: ${review_notes}` : ''}`;
        // Notify requesting user
        recipients = requestingUser?.email ? [requestingUser.email] : [];

        // Create in-app notification for requesting user
        await supabase.from('notifications').insert({
          user_id: requesting_user_id,
          type: 'rejection',
          title: 'Shift Swap Rejected',
          message: `Your shift swap request has been rejected${review_notes ? ': ' + review_notes : ''}`,
          link: `/schedule?tab=schedule&showRequests=true`,
          metadata: { swap_date }
        });
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
