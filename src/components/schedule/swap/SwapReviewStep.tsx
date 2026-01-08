import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeftRight, Calendar, Clock, User, Lightbulb, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TargetShift } from './SwapTargetSelector';
import { OfferShift } from './SwapOfferSelector';
import { validateSwapRequest } from '@/lib/swapValidation';

interface SwapReviewStepProps {
  currentUserId: string;
  targetShift: TargetShift;
  offerShift: OfferShift | null;
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
  onSuccess,
}: SwapReviewStepProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCrossDate = offerShift && offerShift.date !== targetShift.date;
  const isCrossTeam = offerShift && offerShift.teamId !== targetShift.teamId;

  const handleSubmit = async () => {
    if (!offerShift) {
      toast.error('Please select a shift to offer or skip this step');
      return;
    }

    setSubmitting(true);
    try {
      // Validate the swap request
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

      // Create the swap request
      const { error } = await supabase.from('shift_swap_requests').insert({
        requesting_user_id: currentUserId,
        requesting_entry_id: offerShift.entryId,
        target_user_id: targetShift.userId,
        target_entry_id: targetShift.entryId,
        swap_date: targetShift.date,
        team_id: targetShift.teamId,
        reason: reason.trim() || null,
        status: 'pending',
      });

      if (error) throw error;

      // Send notification
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

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground">
          <strong>Step 3:</strong> Review your swap request and add an optional reason before submitting.
        </p>
      </div>

      {/* Swap summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-6">
            {/* Your shift (what you're giving) */}
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">You Give</p>
              {offerShift ? (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">{format(new Date(offerShift.date), 'EEE, MMM d')}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{SHIFT_LABELS[offerShift.shiftType]}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{offerShift.teamName}</p>
                </div>
              ) : (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground italic">No shift offered</p>
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowLeftRight className="h-6 w-6 text-primary" />
              </div>
            </div>

            {/* Their shift (what you're getting) */}
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">You Get</p>
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center justify-center gap-1 text-primary mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">{format(new Date(targetShift.date), 'EEE, MMM d')}</span>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Clock className="h-4 w-4 text-primary/70" />
                  <span className="text-primary">{SHIFT_LABELS[targetShift.shiftType]}</span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">from {targetShift.userName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Badges for cross-date/cross-team */}
          {(isCrossDate || isCrossTeam) && (
            <div className="flex justify-center gap-2 mt-4">
              {isCrossDate && (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                  Cross-date swap
                </Badge>
              )}
              {isCrossTeam && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-200">
                  Cross-team swap
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning if no offer */}
      {!offerShift && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You haven't selected a shift to offer. Please go back and select one of your shifts to swap, or choose to skip offering a shift.
          </AlertDescription>
        </Alert>
      )}

      {/* Reason input */}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason for swap (optional)</Label>
        <Textarea
          id="reason"
          placeholder="e.g., Doctor's appointment, family event, personal commitment..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>

      {/* Tip */}
      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Lightbulb className="h-4 w-4 mt-0.5 text-yellow-500" />
        <p>
          <strong>Tip:</strong> Adding a clear reason increases the chance of approval. 
          Your manager will review this request before it's finalized.
        </p>
      </div>

      {/* Submit button */}
      <Button 
        onClick={handleSubmit} 
        disabled={submitting || !offerShift}
        className="w-full"
        size="lg"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            Submit Swap Request
          </>
        )}
      </Button>
    </div>
  );
}
