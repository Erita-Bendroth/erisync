import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight } from 'lucide-react';
import { ShiftSwapWizard } from './ShiftSwapWizard';

interface QuickSwapButtonProps {
  currentUserId: string;
  teamIds: string[];
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function QuickSwapButton({
  currentUserId,
  teamIds,
  variant = 'outline',
  size = 'default',
  className,
}: QuickSwapButtonProps) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setWizardOpen(true)}
        className={className}
      >
        <ArrowLeftRight className="h-4 w-4 mr-2" />
        Request Swap
      </Button>

      <ShiftSwapWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        currentUserId={currentUserId}
        teamIds={teamIds}
      />
    </>
  );
}
