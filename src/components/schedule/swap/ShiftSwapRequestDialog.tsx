/**
 * ShiftSwapRequestDialog — thin shell around ShiftSwapWizard.
 *
 * Historically this was a standalone dialog with its own form. As of the swap
 * consolidation pass it now opens the unified ShiftSwapWizard pre-filled with
 * the target shift, so all swap flows share one UI.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShiftSwapWizard } from './ShiftSwapWizard';
import type { TargetShift } from './SwapTargetSelector';

interface ShiftSwapRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestingUserId: string;
  targetUserId: string;
  targetUserName: string;
  targetEntryId: string;
  swapDate: string;
  teamId: string;
}

export function ShiftSwapRequestDialog({
  open,
  onOpenChange,
  requestingUserId,
  targetUserId,
  targetUserName,
  targetEntryId,
  swapDate,
  teamId,
}: ShiftSwapRequestDialogProps) {
  const [prefilledTarget, setPrefilledTarget] = useState<TargetShift | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [{ data: entry }, { data: team }, { data: profile }] = await Promise.all([
        supabase.from('schedule_entries').select('shift_type').eq('id', targetEntryId).maybeSingle(),
        supabase.from('teams').select('name').eq('id', teamId).maybeSingle(),
        supabase.from('profiles').select('initials').eq('user_id', targetUserId).maybeSingle(),
      ]);
      if (cancelled) return;
      setPrefilledTarget({
        entryId: targetEntryId,
        userId: targetUserId,
        userName: targetUserName,
        userInitials: profile?.initials || targetUserName.slice(0, 2).toUpperCase(),
        date: swapDate,
        shiftType: (entry?.shift_type as string) || 'normal',
        teamId,
        teamName: team?.name || '',
      });
    })();
    return () => { cancelled = true; };
  }, [open, targetEntryId, targetUserId, targetUserName, swapDate, teamId]);

  return (
    <ShiftSwapWizard
      open={open}
      onOpenChange={onOpenChange}
      currentUserId={requestingUserId}
      teamIds={[teamId]}
      prefilledTarget={prefilledTarget}
    />
  );
}
