import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface SwapRequest {
  id: string;
  status: string;
  swap_date: string;
  created_at: string;
  target_user: { first_name: string; last_name: string } | null;
  requesting_user: { first_name: string; last_name: string } | null;
}

interface SwapStatusCardsProps {
  userId: string;
  onViewAll?: () => void;
}

export function SwapStatusCards({ userId, onViewAll }: SwapStatusCardsProps) {
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [recentRequest, setRecentRequest] = useState<SwapRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSwapStats();
  }, [userId]);

  const fetchSwapStats = async () => {
    try {
      // Get counts by status for requests I made
      const { data: myRequests } = await supabase
        .from('shift_swap_requests')
        .select('id, status, swap_date, created_at, target_user_id')
        .eq('requesting_user_id', userId)
        .order('created_at', { ascending: false });

      // Get counts by status for requests made to me
      const { data: requestsToMe } = await supabase
        .from('shift_swap_requests')
        .select('id, status')
        .eq('target_user_id', userId)
        .eq('status', 'pending');

      const pending = (myRequests?.filter(r => r.status === 'pending').length || 0) +
                      (requestsToMe?.length || 0);
      const approved = myRequests?.filter(r => r.status === 'approved').length || 0;
      const rejected = myRequests?.filter(r => r.status === 'rejected').length || 0;

      setStats({ pending, approved, rejected });

      // Get most recent pending request with user info
      if (myRequests && myRequests.length > 0) {
        const mostRecent = myRequests[0];
        
        if (mostRecent.target_user_id) {
          const { data: targetUser } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', mostRecent.target_user_id)
            .single();

          setRecentRequest({
            ...mostRecent,
            target_user: targetUser,
            requesting_user: null,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching swap stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  // Don't show if no swap activity
  if (stats.pending === 0 && stats.approved === 0 && stats.rejected === 0) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            <span className="font-medium">Shift Swap Requests</span>
          </div>
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs">
              View All
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Status badges */}
          <div className="flex items-center gap-2">
            {stats.pending > 0 && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                <Clock className="h-3 w-3 mr-1" />
                {stats.pending} Pending
              </Badge>
            )}
            {stats.approved > 0 && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                {stats.approved} Approved
              </Badge>
            )}
            {stats.rejected > 0 && (
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                <XCircle className="h-3 w-3 mr-1" />
                {stats.rejected} Rejected
              </Badge>
            )}
          </div>

          {/* Most recent request preview */}
          {recentRequest && recentRequest.status === 'pending' && (
            <div className="ml-auto text-sm text-muted-foreground">
              Waiting on {recentRequest.target_user?.first_name || 'colleague'} for{' '}
              {format(new Date(recentRequest.swap_date), 'MMM d')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
