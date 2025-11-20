import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

const regionsByCountry: Record<string, Array<{ code: string; name: string }>> = {
  DE: [
    { code: "BW", name: "Baden-Württemberg" },
    { code: "BY", name: "Bavaria (Bayern)" },
    { code: "BE", name: "Berlin" },
    { code: "BB", name: "Brandenburg" },
    { code: "HB", name: "Bremen" },
    { code: "HH", name: "Hamburg" },
    { code: "HE", name: "Hesse (Hessen)" },
    { code: "MV", name: "Mecklenburg-Vorpommern" },
    { code: "NI", name: "Lower Saxony (Niedersachsen)" },
    { code: "NW", name: "North Rhine-Westphalia" },
    { code: "RP", name: "Rhineland-Palatinate" },
    { code: "SL", name: "Saarland" },
    { code: "SN", name: "Saxony (Sachsen)" },
    { code: "ST", name: "Saxony-Anhalt" },
    { code: "SH", name: "Schleswig-Holstein" },
    { code: "TH", name: "Thuringia (Thüringen)" }
  ],
  GB: [
    { code: "GB-ENG", name: "England & Wales" },
    { code: "GB-SCT", name: "Scotland" },
    { code: "GB-NIR", name: "Northern Ireland" }
  ],
  BE: [
    { code: "BE-VLG", name: "Flanders (Vlaanderen)" },
    { code: "BE-WAL", name: "Wallonia (Wallonie)" },
    { code: "BE-BRU", name: "Brussels (Bruxelles)" }
  ],
};

interface RegionSelectionStepProps {
  selectedCountry: string;
  selectedRegions: string[];
  onSelectRegions: (regions: string[]) => void;
}

export const RegionSelectionStep: React.FC<RegionSelectionStepProps> = ({
  selectedCountry,
  selectedRegions,
  onSelectRegions,
}) => {
  const regions = regionsByCountry[selectedCountry] || [];

  const toggleRegion = (regionCode: string) => {
    if (selectedRegions.includes(regionCode)) {
      onSelectRegions(selectedRegions.filter(r => r !== regionCode));
    } else {
      onSelectRegions([...selectedRegions, regionCode]);
    }
  };

  const selectAll = () => {
    onSelectRegions(regions.map(r => r.code));
  };

  const clearAll = () => {
    onSelectRegions([]);
  };

  const allSelected = selectedRegions.length === regions.length;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <MapPin className="h-12 w-12 mx-auto text-primary mb-3" />
        <h3 className="text-lg font-semibold">Select Regions</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which regions to import holidays for
        </p>
      </div>

      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {selectedRegions.length} of {regions.length} selected
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={allSelected}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={selectedRegions.length === 0}
          >
            <Square className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
        {regions.map((region) => {
          const isSelected = selectedRegions.includes(region.code);

          return (
            <Card
              key={region.code}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary bg-accent"
              )}
              onClick={() => toggleRegion(region.code)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleRegion(region.code)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{region.name}</p>
                    <p className="text-xs text-muted-foreground">{region.code}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground text-center">
          💡 <strong>Tip:</strong> Each region may have different public holidays.
          Select the regions where your team members are located.
        </p>
      </div>
    </div>
  );
};
