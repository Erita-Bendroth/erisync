import { Button } from '@/components/ui/button';
import { ArrowLeftRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShiftSwapWizard } from './ShiftSwapWizard';
import type { TargetShift } from './SwapTargetSelector';

interface ShiftSwapRequestButtonProps {
  targetUserId: string;
  targetUserName: string;
  targetEntryId: string;
  date: string;
  shiftType: string;
  teamId: string;
  currentUserId: string;
  currentUserEntryId?: string;
  disabled?: boolean;
}

export function ShiftSwapRequestButton({
  targetUserId,
  targetUserName,
  targetEntryId,
  date,
  shiftType,
  teamId,
  currentUserId,
  currentUserEntryId,
  disabled = false
}: ShiftSwapRequestButtonProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [prefilledTarget, setPrefilledTarget] = useState<TargetShift | null>(null);

  // Don't show button if viewing own shift
  if (currentUserId === targetUserId) {
    return null;
  }

  // Don't show for past dates
  const shiftDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (shiftDate < today) {
    return null;
  }

  const handleClick = async () => {
    // Resolve team name + initials so the wizard can render the target nicely.
    const [{ data: team }, { data: profile }] = await Promise.all([
      supabase.from('teams').select('name').eq('id', teamId).maybeSingle(),
      supabase.from('profiles').select('initials').eq('user_id', targetUserId).maybeSingle(),
    ]);
    setPrefilledTarget({
      entryId: targetEntryId,
      userId: targetUserId,
      userName: targetUserName,
      userInitials: profile?.initials || targetUserName.slice(0, 2).toUpperCase(),
      date,
      shiftType: shiftType || 'normal',
      teamId,
      teamName: team?.name || '',
    });
    setWizardOpen(true);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={disabled}
        className="h-6 px-2 text-xs"
      >
        <ArrowLeftRight className="h-3 w-3 mr-1" />
        Swap
      </Button>
      <ShiftSwapWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        currentUserId={currentUserId}
        teamIds={[teamId]}
        prefilledTarget={prefilledTarget}
      />
    </>
  );
}
