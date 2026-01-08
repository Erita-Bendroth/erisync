import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeftRight, Calendar, Clock, User, Lightbulb, Loader2, Check, AlertTriangle, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TargetShift } from './SwapTargetSelector';
import { validateSwapRequest } from '@/lib/swapValidation';

interface SwapReviewStepProps {
  currentUserId: string;
  targetShift?: TargetShift | null;
  offerShift?: { entryId: string; date: string; shiftType: string; teamId: string; teamName: string } | null;
  isOpenOffer?: boolean;
  onSuccess: () => void;
}

const SHIFT_LABELS: Record<string, string> = {
  normal: 'Normal',
  early: 'Early',
  late: 'Late',
  night: 'Night',
  oncall: 'On-Call',
  weekend: 'Weekend',
  flex: 'Flex',
};

export function SwapReviewStep({
  currentUserId,
  targetShift,
  offerShift,
  isOpenOffer = false,
  onSuccess,
}: SwapReviewStepProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCrossDate = offerShift && targetShift && offerShift.date !== targetShift.date;
  const isCrossTeam = offerShift && targetShift && offerShift.teamId !== targetShift.teamId;

  const handleSubmit = async () => {
    if (!offerShift) {
      toast.error('Please select a shift to offer');
      return;
    }

    setSubmitting(true);
    try {
      if (isOpenOffer) {
        const { error } = await supabase
          .from('shift_swap_requests')
          .insert({
            requesting_user_id: currentUserId,
            requesting_entry_id: offerShift.entryId,
            target_user_id: null,
            target_entry_id: null,
            swap_date: offerShift.date,
            team_id: offerShift.teamId,
            reason: reason.trim() || null,
            is_open_offer: true,
            status: 'pending',
          });

        if (error) throw error;

        toast.success('Open offer posted!', {
          description: 'Your teammates can now claim this shift.'
        });
        onSuccess();
        return;
      }

      if (!targetShift) {
        toast.error('Please select a target shift');
        setSubmitting(false);
        return;
      }

      const validation = await validateSwapRequest(
        currentUserId,
        offerShift.entryId,
        targetShift.userId,
        targetShift.entryId,
        new Date(targetShift.date),
        targetShift.teamId
      );

      if (!validation.valid) {
        toast.error(validation.error || 'Invalid swap request');
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('shift_swap_requests').insert({
        requesting_user_id: currentUserId,
        requesting_entry_id: offerShift.entryId,
        target_user_id: targetShift.userId,
        target_entry_id: targetShift.entryId,
        swap_date: targetShift.date,
        team_id: targetShift.teamId,
        reason: reason.trim() || null,
        is_open_offer: false,
        status: 'pending',
      });

      if (error) throw error;

      try {
        await supabase.functions.invoke('send-swap-notification', {
          body: {
            requestingUserId: currentUserId,
            targetUserId: targetShift.userId,
            swapDate: targetShift.date,
            teamId: targetShift.teamId,
          },
        });
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      toast.success('Swap request submitted successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error submitting swap request:', error);
      toast.error('Failed to submit swap request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isOpenOffer && offerShift) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <Megaphone className="h-5 w-5" />
          <span className="font-medium">Posting Open Offer</span>
        </div>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-3">Shift you're offering:</p>
            <div className="p-4 bg-muted rounded-lg text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{format(new Date(offerShift.date), 'EEEE, MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{SHIFT_LABELS[offerShift.shiftType] || offerShift.shiftType}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{offerShift.teamName}</p>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <Megaphone className="h-4 w-4" />
          <AlertDescription>
            This shift will be visible to all team members. Anyone can claim it, pending manager approval.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="reason">Why are you offering this shift? (optional)</Label>
          <Textarea
            id="reason"
            placeholder="Let teammates know why you're offering this shift..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Posting...</> : <><Check className="h-4 w-4 mr-2" />Post Open Offer</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-6">
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">You Give</p>
              {offerShift ? (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{format(new Date(offerShift.date), 'EEE, MMM d')}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{SHIFT_LABELS[offerShift.shiftType] || offerShift.shiftType}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{offerShift.teamName}</p>
                </div>
              ) : (
                <div className="p-4 bg-muted rounded-lg"><p className="text-muted-foreground italic">No shift selected</p></div>
              )}
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowLeftRight className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">You Get</p>
              {targetShift ? (
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">{format(new Date(targetShift.date), 'EEE, MMM d')}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-4 w-4 text-primary/70" />
                    <span className="text-primary">{SHIFT_LABELS[targetShift.shiftType] || targetShift.shiftType}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">from {targetShift.userName}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-muted rounded-lg"><p className="text-muted-foreground italic">No shift selected</p></div>
              )}
            </div>
          </div>
          {(isCrossDate || isCrossTeam) && (
            <div className="flex justify-center gap-2 mt-4">
              {isCrossDate && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">Cross-date swap</Badge>}
              {isCrossTeam && <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-200">Cross-team swap</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {!offerShift && (
        <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>Please go back and select one of your shifts to swap.</AlertDescription></Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="reason">Reason for swap (optional)</Label>
        <Textarea id="reason" placeholder="e.g., Doctor's appointment, family event..." value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
      </div>

      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Lightbulb className="h-4 w-4 mt-0.5 text-yellow-500" />
        <p><strong>Tip:</strong> Adding a clear reason increases the chance of approval.</p>
      </div>

      <Button onClick={handleSubmit} disabled={submitting || !offerShift || !targetShift} className="w-full" size="lg">
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : <><Check className="h-4 w-4 mr-2" />Submit Swap Request</>}
      </Button>
    </div>
  );
}