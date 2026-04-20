import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeftRight, ArrowRight, ChevronLeft } from 'lucide-react';
import { SwapModeSelector, SwapMode } from './SwapModeSelector';
import { MyShiftSelector, MyShift } from './MyShiftSelector';
import { SwapTargetSelector, TargetShift } from './SwapTargetSelector';
import { SwapReviewStep } from './SwapReviewStep';

interface ShiftSwapWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  teamIds: string[];
  /**
   * Optional pre-filled target shift. When supplied, the wizard skips
   * the mode + target-selection steps and jumps straight to "select my shift".
   * Used by ShiftSwapRequestButton / ShiftSwapRequestDialog when the user
   * clicked "Swap" on a specific colleague's shift in the schedule.
   */
  prefilledTarget?: TargetShift | null;
}

export type WizardStep = 'select-mode' | 'select-my-shift' | 'select-target' | 'review';

const DIRECT_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'select-mode', label: 'Choose Type' },
  { key: 'select-my-shift', label: 'Your Shift' },
  { key: 'select-target', label: 'Target Shift' },
  { key: 'review', label: 'Review' },
];

const OPEN_OFFER_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'select-mode', label: 'Choose Type' },
  { key: 'select-my-shift', label: 'Your Shift' },
  { key: 'review', label: 'Review & Post' },
];

export function ShiftSwapWizard({ 
  open, 
  onOpenChange, 
  currentUserId,
  teamIds,
  prefilledTarget = null,
}: ShiftSwapWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    prefilledTarget ? 'select-my-shift' : 'select-mode'
  );
  const [swapMode, setSwapMode] = useState<SwapMode | null>(
    prefilledTarget ? 'direct' : null
  );
  const [selectedMyShift, setSelectedMyShift] = useState<MyShift | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<TargetShift | null>(prefilledTarget);

  // Keep wizard in sync if the prefilled target arrives after mount (e.g. dialog reopens).
  React.useEffect(() => {
    if (prefilledTarget) {
      setSelectedTarget(prefilledTarget);
      setSwapMode('direct');
      if (currentStep === 'select-mode') setCurrentStep('select-my-shift');
    }
  }, [prefilledTarget]);

  const steps = swapMode === 'open-offer' ? OPEN_OFFER_STEPS : DIRECT_STEPS;
  const currentStepIndex = steps.findIndex(s => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setCurrentStep(prefilledTarget ? 'select-my-shift' : 'select-mode');
      setSwapMode(prefilledTarget ? 'direct' : null);
      setSelectedMyShift(null);
      setSelectedTarget(prefilledTarget);
    }, 200);
  };

  const handleNext = () => {
    if (currentStep === 'select-mode' && swapMode) {
      setCurrentStep('select-my-shift');
    } else if (currentStep === 'select-my-shift' && selectedMyShift) {
      if (swapMode === 'open-offer') {
        setCurrentStep('review');
      } else if (prefilledTarget) {
        // Target was pre-filled — skip target selection.
        setCurrentStep('review');
      } else {
        setCurrentStep('select-target');
      }
    } else if (currentStep === 'select-target' && selectedTarget) {
      setCurrentStep('review');
    }
  };

  const handleBack = () => {
    if (currentStep === 'select-my-shift') {
      // If target was pre-filled there's no mode step to go back to — just close.
      if (prefilledTarget) {
        handleClose();
      } else {
        setCurrentStep('select-mode');
      }
    } else if (currentStep === 'select-target') {
      setCurrentStep('select-my-shift');
    } else if (currentStep === 'review') {
      if (swapMode === 'open-offer') {
        setCurrentStep('select-my-shift');
      } else if (prefilledTarget) {
        setCurrentStep('select-my-shift');
      } else {
        setCurrentStep('select-target');
      }
    }
  };

  const handleSuccess = () => {
    handleClose();
  };

  const canProceed = () => {
    if (currentStep === 'select-mode') return !!swapMode;
    if (currentStep === 'select-my-shift') return !!selectedMyShift;
    if (currentStep === 'select-target') return !!selectedTarget;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            {swapMode === 'open-offer' ? 'Post Open Shift Offer' : 'Request Shift Swap'}
          </DialogTitle>
          
          {/* Progress indicator */}
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              {steps.map((step, idx) => (
                <span 
                  key={step.key}
                  className={idx <= currentStepIndex ? 'text-primary font-medium' : ''}
                >
                  {idx + 1}. {step.label}
                </span>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 min-h-0">
          {currentStep === 'select-mode' && (
            <SwapModeSelector
              selectedMode={swapMode}
              onSelectMode={setSwapMode}
            />
          )}

          {currentStep === 'select-my-shift' && (
            <MyShiftSelector
              currentUserId={currentUserId}
              teamIds={teamIds}
              selectedShift={selectedMyShift}
              onSelectShift={setSelectedMyShift}
            />
          )}

          {currentStep === 'select-target' && selectedMyShift && (
            <SwapTargetSelector
              currentUserId={currentUserId}
              teamIds={teamIds}
              selectedShift={selectedTarget}
              onSelectShift={setSelectedTarget}
            />
          )}

          {currentStep === 'review' && selectedMyShift && (
            <SwapReviewStep
              currentUserId={currentUserId}
              offerShift={selectedMyShift}
              targetShift={swapMode === 'direct' ? selectedTarget : undefined}
              isOpenOffer={swapMode === 'open-offer'}
              onSuccess={handleSuccess}
            />
          )}
        </div>

        <div className="flex-shrink-0 flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 'select-mode' ? handleClose : handleBack}
          >
            {currentStep === 'select-mode' ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </>
            )}
          </Button>

          {currentStep !== 'review' && (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
