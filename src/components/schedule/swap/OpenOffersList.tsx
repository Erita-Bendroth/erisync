import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, Users, Megaphone, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface OpenOffer {
  id: string;
  requestingUserId: string;
  requestingUserName: string;
  entryId: string;
  date: string;
  shiftType: string;
  teamId: string;
  teamName: string;
  reason: string | null;
  createdAt: string;
}

interface OpenOffersListProps {
  currentUserId: string;
  teamIds: string[];
  onClaimSuccess?: () => void;
}

export function OpenOffersList({ currentUserId, teamIds, onClaimSuccess }: OpenOffersListProps) {
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<OpenOffer[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOpenOffers();
  }, [currentUserId, teamIds]);

  const fetchOpenOffers = async () => {
    if (teamIds.length === 0) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('shift_swap_requests')
        .select(`
          id,
          requesting_user_id,
          requesting_entry_id,
          swap_date,
          team_id,
          reason,
          created_at,
          requesting_profile:requesting_user_id (first_name, last_name),
          requesting_entry:requesting_entry_id (shift_type),
          team:team_id (name)
        `)
        .eq('is_open_offer', true)
        .eq('status', 'pending')
        .in('team_id', teamIds)
        .neq('requesting_user_id', currentUserId)
        .gte('swap_date', today)
        .order('swap_date', { ascending: true });

      if (error) throw error;

      const formattedOffers: OpenOffer[] = (data || []).map((offer: any) => ({
        id: offer.id,
        requestingUserId: offer.requesting_user_id,
        requestingUserName: offer.requesting_profile 
          ? `${offer.requesting_profile.first_name} ${offer.requesting_profile.last_name}`
          : 'Unknown',
        entryId: offer.requesting_entry_id,
        date: offer.swap_date,
        shiftType: offer.requesting_entry?.shift_type || 'normal',
        teamId: offer.team_id,
        teamName: offer.team?.name || 'Unknown Team',
        reason: offer.reason,
        createdAt: offer.created_at,
      }));

      setOffers(formattedOffers);
    } catch (error) {
      console.error('Error fetching open offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (offer: OpenOffer) => {
    setClaimingId(offer.id);
    try {
      // Get user's shift on the same date to offer in exchange
      const { data: myShifts, error: shiftError } = await supabase
        .from('schedule_entries')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('date', offer.date)
        .in('shift_type', ['normal', 'early', 'late', 'weekend'])
        .limit(1);

      if (shiftError) throw shiftError;

      const myEntryId = myShifts?.[0]?.id || null;

      // Update the open offer to be claimed by this user
      const { error } = await supabase
        .from('shift_swap_requests')
        .update({
          target_user_id: currentUserId,
          target_entry_id: myEntryId,
          is_open_offer: false, // No longer open
          updated_at: new Date().toISOString(),
        })
        .eq('id', offer.id)
        .eq('status', 'pending');

      if (error) throw error;

      toast.success('Shift claimed!', {
        description: 'The swap request is now pending manager approval.'
      });

      // Notify original user
      try {
        await supabase.functions.invoke('send-swap-notification', {
          body: {
            targetUserId: offer.requestingUserId,
            requestingUserId: currentUserId,
            swapDate: offer.date,
            type: 'offer_claimed'
          }
        });
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      fetchOpenOffers();
      onClaimSuccess?.();
    } catch (error: any) {
      console.error('Error claiming offer:', error);
      toast.error('Failed to claim shift', {
        description: error.message
      });
    } finally {
      setClaimingId(null);
    }
  };

  const getShiftTypeColor = (type: string) => {
    switch (type) {
      case 'early': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'late': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'weekend': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Megaphone className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>No open shift offers available</p>
        <p className="text-xs mt-1">Check back later or post your own offer</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Megaphone className="h-4 w-4 text-primary" />
        <span>Open Shift Offers ({offers.length})</span>
      </div>

      {offers.map((offer) => (
        <Card key={offer.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{offer.requestingUserName}</span>
                <span className="text-muted-foreground">is offering:</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={getShiftTypeColor(offer.shiftType)}>
                  <Clock className="h-3 w-3 mr-1" />
                  {offer.shiftType}
                </Badge>
                <div className="flex items-center gap-1 text-sm">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {format(new Date(offer.date), 'EEE, MMM d')}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {offer.teamName}
                </div>
              </div>
              {offer.reason && (
                <p className="text-sm text-muted-foreground italic">"{offer.reason}"</p>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => handleClaim(offer)}
              disabled={claimingId === offer.id}
            >
              {claimingId === offer.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Claim'
              )}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
