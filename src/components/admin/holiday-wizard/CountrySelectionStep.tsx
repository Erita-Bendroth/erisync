import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const countries = [
  { code: "DE", name: "Germany", emoji: "🇩🇪", regions: true, group: "Europe" },
  { code: "AT", name: "Austria", emoji: "🇦🇹", regions: false, group: "Europe" },
  { code: "BE", name: "Belgium", emoji: "🇧🇪", regions: true, group: "Europe" },
  { code: "BG", name: "Bulgaria", emoji: "🇧🇬", regions: false, group: "Europe" },
  { code: "HR", name: "Croatia", emoji: "🇭🇷", regions: false, group: "Europe" },
  { code: "CY", name: "Cyprus", emoji: "🇨🇾", regions: false, group: "Europe" },
  { code: "CZ", name: "Czech Republic", emoji: "🇨🇿", regions: false, group: "Europe" },
  { code: "DK", name: "Denmark", emoji: "🇩🇰", regions: false, group: "Europe" },
  { code: "EE", name: "Estonia", emoji: "🇪🇪", regions: false, group: "Europe" },
  { code: "FI", name: "Finland", emoji: "🇫🇮", regions: false, group: "Europe" },
  { code: "FR", name: "France", emoji: "🇫🇷", regions: false, group: "Europe" },
  { code: "GR", name: "Greece", emoji: "🇬🇷", regions: false, group: "Europe" },
  { code: "HU", name: "Hungary", emoji: "🇭🇺", regions: false, group: "Europe" },
  { code: "IE", name: "Ireland", emoji: "🇮🇪", regions: false, group: "Europe" },
  { code: "IT", name: "Italy", emoji: "🇮🇹", regions: false, group: "Europe" },
  { code: "LV", name: "Latvia", emoji: "🇱🇻", regions: false, group: "Europe" },
  { code: "LT", name: "Lithuania", emoji: "🇱🇹", regions: false, group: "Europe" },
  { code: "LU", name: "Luxembourg", emoji: "🇱🇺", regions: false, group: "Europe" },
  { code: "MT", name: "Malta", emoji: "🇲🇹", regions: false, group: "Europe" },
  { code: "NL", name: "Netherlands", emoji: "🇳🇱", regions: false, group: "Europe" },
  { code: "PL", name: "Poland", emoji: "🇵🇱", regions: false, group: "Europe" },
  { code: "PT", name: "Portugal", emoji: "🇵🇹", regions: false, group: "Europe" },
  { code: "RO", name: "Romania", emoji: "🇷🇴", regions: false, group: "Europe" },
  { code: "SK", name: "Slovakia", emoji: "🇸🇰", regions: false, group: "Europe" },
  { code: "SI", name: "Slovenia", emoji: "🇸🇮", regions: false, group: "Europe" },
  { code: "ES", name: "Spain", emoji: "🇪🇸", regions: false, group: "Europe" },
  { code: "SE", name: "Sweden", emoji: "🇸🇪", regions: false, group: "Europe" },
  { code: "CH", name: "Switzerland", emoji: "🇨🇭", regions: false, group: "Europe" },
  { code: "NO", name: "Norway", emoji: "🇳🇴", regions: false, group: "Europe" },
  { code: "IS", name: "Iceland", emoji: "🇮🇸", regions: false, group: "Europe" },
  { code: "GB", name: "United Kingdom", emoji: "🇬🇧", regions: true, group: "Europe" },
  { code: "US", name: "United States", emoji: "🇺🇸", regions: false, group: "Americas" },
  { code: "CA", name: "Canada", emoji: "🇨🇦", regions: false, group: "Americas" },
  { code: "AU", name: "Australia", emoji: "🇦🇺", regions: false, group: "Oceania" },
  { code: "JP", name: "Japan", emoji: "🇯🇵", regions: false, group: "Asia" },
];

interface CountrySelectionStepProps {
  selectedCountry: string;
  onSelectCountry: (code: string, name: string, hasRegions: boolean) => void;
}

export const CountrySelectionStep: React.FC<CountrySelectionStepProps> = ({
  selectedCountry,
  onSelectCountry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedCountries = filteredCountries.reduce((acc, country) => {
    if (!acc[country.group]) {
      acc[country.group] = [];
    }
    acc[country.group].push(country);
    return acc;
  }, {} as Record<string, typeof countries>);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search countries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-6">
        {Object.entries(groupedCountries).map(([group, groupCountries]) => (
          <div key={group}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {group}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {groupCountries.map((country) => (
                <Card
                  key={country.code}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selectedCountry === country.code && "ring-2 ring-primary bg-accent"
                  )}
                  onClick={() => onSelectCountry(country.code, country.name, country.regions)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-2xl">{country.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{country.name}</p>
                          <p className="text-xs text-muted-foreground">{country.code}</p>
                        </div>
                      </div>
                      {selectedCountry === country.code && (
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                    {country.regions && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        Regional holidays available
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredCountries.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No countries found</p>
        </div>
      )}
    </div>
  );
};
