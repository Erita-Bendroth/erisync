import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeftRight, ArrowRight, Check, ChevronLeft } from 'lucide-react';
import { SwapTargetSelector, TargetShift } from './SwapTargetSelector';
import { SwapOfferSelector, OfferShift } from './SwapOfferSelector';
import { SwapReviewStep } from './SwapReviewStep';

interface ShiftSwapWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  teamIds: string[];
}

export type WizardStep = 'select-target' | 'select-offer' | 'review';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'select-target', label: 'Select Shift to Request' },
  { key: 'select-offer', label: 'Offer Your Shift (Optional)' },
  { key: 'review', label: 'Review & Submit' },
];

export function ShiftSwapWizard({ 
  open, 
  onOpenChange, 
  currentUserId,
  teamIds 
}: ShiftSwapWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('select-target');
  const [selectedTarget, setSelectedTarget] = useState<TargetShift | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<OfferShift | null>(null);
  const [skipOffer, setSkipOffer] = useState(false);

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setCurrentStep('select-target');
      setSelectedTarget(null);
      setSelectedOffer(null);
      setSkipOffer(false);
    }, 200);
  };

  const handleNext = () => {
    if (currentStep === 'select-target' && selectedTarget) {
      setCurrentStep('select-offer');
    } else if (currentStep === 'select-offer') {
      setCurrentStep('review');
    }
  };

  const handleBack = () => {
    if (currentStep === 'select-offer') {
      setCurrentStep('select-target');
    } else if (currentStep === 'review') {
      setCurrentStep('select-offer');
    }
  };

  const handleSuccess = () => {
    handleClose();
  };

  const canProceed = () => {
    if (currentStep === 'select-target') return !!selectedTarget;
    if (currentStep === 'select-offer') return skipOffer || !!selectedOffer;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Request Shift Swap
          </DialogTitle>
          
          {/* Progress indicator */}
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              {STEPS.map((step, idx) => (
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
          {currentStep === 'select-target' && (
            <SwapTargetSelector
              currentUserId={currentUserId}
              teamIds={teamIds}
              selectedShift={selectedTarget}
              onSelectShift={setSelectedTarget}
            />
          )}

          {currentStep === 'select-offer' && selectedTarget && (
            <SwapOfferSelector
              currentUserId={currentUserId}
              teamIds={teamIds}
              targetShift={selectedTarget}
              selectedOffer={selectedOffer}
              onSelectOffer={setSelectedOffer}
              skipOffer={skipOffer}
              onSkipOfferChange={setSkipOffer}
            />
          )}

          {currentStep === 'review' && selectedTarget && (
            <SwapReviewStep
              currentUserId={currentUserId}
              targetShift={selectedTarget}
              offerShift={skipOffer ? null : selectedOffer}
              onSuccess={handleSuccess}
            />
          )}
        </div>

        <div className="flex-shrink-0 flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 'select-target' ? handleClose : handleBack}
          >
            {currentStep === 'select-target' ? (
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
