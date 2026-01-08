import React from 'react';
import { Card } from '@/components/ui/card';
import { ArrowLeftRight, Megaphone, Check } from 'lucide-react';

export type SwapMode = 'direct' | 'open-offer';

interface SwapModeSelectorProps {
  selectedMode: SwapMode | null;
  onSelectMode: (mode: SwapMode) => void;
}

export function SwapModeSelector({ selectedMode, onSelectMode }: SwapModeSelectorProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose how you'd like to swap your shift
      </p>

      <div className="grid gap-3">
        <Card
          className={`p-4 cursor-pointer transition-all hover:border-primary ${
            selectedMode === 'direct' 
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
              : 'hover:bg-muted/50'
          }`}
          onClick={() => onSelectMode('direct')}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              selectedMode === 'direct' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Swap with Someone</h3>
                {selectedMode === 'direct' && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Select your shift, then find a colleague's shift to exchange with
              </p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all hover:border-primary ${
            selectedMode === 'open-offer' 
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
              : 'hover:bg-muted/50'
          }`}
          onClick={() => onSelectMode('open-offer')}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              selectedMode === 'open-offer' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Post Open Offer</h3>
                {selectedMode === 'open-offer' && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Offer your shift for anyone on the team to claim
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
