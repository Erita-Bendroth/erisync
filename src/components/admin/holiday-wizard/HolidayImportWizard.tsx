import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CountrySelectionStep } from './CountrySelectionStep';
import { YearSelectionStep } from './YearSelectionStep';
import { RegionSelectionStep } from './RegionSelectionStep';
import { ReviewImportStep } from './ReviewImportStep';
import { WizardProgress } from './WizardProgress';

interface HolidayImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export interface WizardData {
  country: string;
  countryName: string;
  year: number;
  regions: string[];
  hasRegions: boolean;
}

const steps = [
  { id: 1, label: 'Country' },
  { id: 2, label: 'Year' },
  { id: 3, label: 'Regions' },
  { id: 4, label: 'Review' },
];

export const HolidayImportWizard: React.FC<HolidayImportWizardProps> = ({
  open,
  onOpenChange,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    country: '',
    countryName: '',
    year: new Date().getFullYear(),
    regions: [],
    hasRegions: false,
  });

  const updateWizardData = (data: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...data }));
  };

  const handleNext = () => {
    // Skip regions step if country doesn't have regions
    if (currentStep === 2 && !wizardData.hasRegions) {
      setCurrentStep(4);
    } else {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    // Skip regions step if country doesn't have regions
    if (currentStep === 4 && !wizardData.hasRegions) {
      setCurrentStep(2);
    } else {
      setCurrentStep(prev => Math.max(prev - 1, 1));
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setWizardData({
      country: '',
      countryName: '',
      year: new Date().getFullYear(),
      regions: [],
      hasRegions: false,
    });
    onOpenChange(false);
  };

  const handleComplete = () => {
    onComplete();
    handleClose();
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!wizardData.country;
      case 2:
        return !!wizardData.year;
      case 3:
        return wizardData.regions.length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Holidays Wizard</DialogTitle>
        </DialogHeader>

        <WizardProgress 
          steps={wizardData.hasRegions ? steps : steps.filter(s => s.id !== 3)} 
          currentStep={currentStep} 
        />

        <div className="flex-1 overflow-y-auto py-6">
          {currentStep === 1 && (
            <CountrySelectionStep
              selectedCountry={wizardData.country}
              onSelectCountry={(country, countryName, hasRegions) => {
                updateWizardData({ country, countryName, hasRegions, regions: [] });
              }}
            />
          )}

          {currentStep === 2 && (
            <YearSelectionStep
              selectedYear={wizardData.year}
              selectedCountry={wizardData.country}
              onSelectYear={(year) => updateWizardData({ year })}
            />
          )}

          {currentStep === 3 && wizardData.hasRegions && (
            <RegionSelectionStep
              selectedCountry={wizardData.country}
              selectedRegions={wizardData.regions}
              onSelectRegions={(regions) => updateWizardData({ regions })}
            />
          )}

          {currentStep === 4 && (
            <ReviewImportStep
              wizardData={wizardData}
              onComplete={handleComplete}
              onBack={handleBack}
            />
          )}
        </div>

        {currentStep < 4 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
