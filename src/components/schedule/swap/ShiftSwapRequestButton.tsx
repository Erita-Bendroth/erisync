import { Button } from '@/components/ui/button';
import { ArrowLeftRight } from 'lucide-react';
import { useState } from 'react';
import { ShiftSwapRequestDialog } from './ShiftSwapRequestDialog';

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
  const [dialogOpen, setDialogOpen] = useState(false);

  // Don't show button if viewing own shift
  if (currentUserId === targetUserId) {
    return null;
  }

  // Don't show if user doesn't have a shift on this date
  if (!currentUserEntryId) {
    return null;
  }

  // Don't show for past dates
  const shiftDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (shiftDate < today) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
        className="h-6 px-2 text-xs"
      >
        <ArrowLeftRight className="h-3 w-3 mr-1" />
        Swap
      </Button>
      <ShiftSwapRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requestingUserId={currentUserId}
        requestingEntryId={currentUserEntryId}
        targetUserId={targetUserId}
        targetUserName={targetUserName}
        targetEntryId={targetEntryId}
        swapDate={date}
        teamId={teamId}
      />
    </>
  );
}
