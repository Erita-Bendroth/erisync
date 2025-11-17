import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface OnlineUser {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
  color: string;
  editing_cell: string | null;
  last_seen: string;
  presence_ref: string;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  initials: string;
}

export const useSchedulerPresence = (
  teamId: string,
  currentUserId: string,
  currentUserProfile: UserProfile,
  editingCell: string | null
) => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!teamId || !currentUserId || !currentUserProfile.firstName) return;

    const channelName = `scheduler:${teamId}`;
    const presenceChannel = supabase.channel(channelName, {
      config: { presence: { key: currentUserId } },
    });

    const userColor = getUserColor(currentUserId);

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users = Object.keys(state).flatMap((key) =>
          state[key].map((presence: any) => ({
            ...presence,
            presence_ref: key,
          }))
        );
        setOnlineUsers(users.filter((u: OnlineUser) => u.user_id !== currentUserId));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined scheduler:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left scheduler:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: currentUserId,
            first_name: currentUserProfile.firstName,
            last_name: currentUserProfile.lastName,
            initials: currentUserProfile.initials,
            color: userColor,
            editing_cell: editingCell,
            last_seen: new Date().toISOString(),
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [teamId, currentUserId, currentUserProfile.firstName]);

  // Update editing cell in real-time
  useEffect(() => {
    if (!channel) return;

    const userColor = getUserColor(currentUserId);

    channel.track({
      user_id: currentUserId,
      first_name: currentUserProfile.firstName,
      last_name: currentUserProfile.lastName,
      initials: currentUserProfile.initials,
      color: userColor,
      editing_cell: editingCell,
      last_seen: new Date().toISOString(),
    });
  }, [editingCell, channel, currentUserId, currentUserProfile]);

  return { onlineUsers };
};

// Generate consistent color for each user based on their ID
const getUserColor = (userId: string): string => {
  const colors = [
    'hsl(217, 91%, 60%)',  // blue
    'hsl(142, 71%, 45%)',  // green
    'hsl(38, 92%, 50%)',   // amber
    'hsl(0, 84%, 60%)',    // red
    'hsl(258, 90%, 66%)',  // violet
    'hsl(330, 81%, 60%)',  // pink
    'hsl(173, 80%, 40%)',  // teal
    'hsl(25, 95%, 53%)',   // orange
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};
