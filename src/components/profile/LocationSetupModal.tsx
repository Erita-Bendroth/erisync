import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

const countries = [
  // European Countries (sorted alphabetically)
  { code: "AD", name: "Andorra" },
  { code: "AL", name: "Albania" },
  { code: "AT", name: "Austria" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "BY", name: "Belarus" },
  { code: "CH", name: "Switzerland" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DE", name: "Germany" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "ES", name: "Spain" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "GR", name: "Greece" },
  { code: "HR", name: "Croatia" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IS", name: "Iceland" },
  { code: "IT", name: "Italy" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "LV", name: "Latvia" },
  { code: "MC", name: "Monaco" },
  { code: "MD", name: "Moldova" },
  { code: "ME", name: "Montenegro" },
  { code: "MK", name: "North Macedonia" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "RS", name: "Serbia" },
  { code: "RU", name: "Russia" },
  { code: "SE", name: "Sweden" },
  { code: "SI", name: "Slovenia" },
  { code: "SK", name: "Slovakia" },
  { code: "SM", name: "San Marino" },
  { code: "UA", name: "Ukraine" },
  { code: "VA", name: "Vatican City" },
  { code: "XK", name: "Kosovo" },
  // Non-European but commonly used
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
];

const germanStates = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bavaria (Bayern)' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hesse (Hessen)' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Lower Saxony (Niedersachsen)' },
  { code: 'NW', name: 'North Rhine-Westphalia (Nordrhein-Westfalen)' },
  { code: 'RP', name: 'Rhineland-Palatinate (Rheinland-Pfalz)' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Saxony (Sachsen)' },
  { code: 'ST', name: 'Saxony-Anhalt (Sachsen-Anhalt)' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thuringia (Thüringen)' },
];

const ukRegions = [
  { code: 'GB-ENG', name: 'England & Wales' },
  { code: 'GB-SCT', name: 'Scotland' },
  { code: 'GB-NIR', name: 'Northern Ireland' },
];

const belgiumRegions = [
  { code: 'BE-VLG', name: 'Flanders (Vlaanderen)' },
  { code: 'BE-WAL', name: 'Wallonia (Wallonie)' },
  { code: 'BE-BRU', name: 'Brussels (Bruxelles)' },
];

interface LocationSetupModalProps {
  open: boolean;
  onComplete: () => void;
}

export function LocationSetupModal({ open, onComplete }: LocationSetupModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [loading, setLoading] = useState(false);

  const importHolidaysForYears = async (countryCode: string, regionCode: string | null) => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1];

    const importPromises = years.map(year => 
      supabase.functions.invoke('import-holidays', {
        body: {
          country_code: countryCode,
          year: year,
          user_id: user?.id,
          region_code: (countryCode === 'DE' || countryCode === 'BE') ? regionCode : null
        }
      })
    );
    
    await Promise.allSettled(importPromises);
  };

  const handleComplete = async () => {
    if (!selectedCountry) {
      toast({
        title: "Country required",
        description: "Please select your country to continue",
        variant: "destructive",
      });
      return;
    }

    // Validate region for DE, GB, and BE
    if ((selectedCountry === 'DE' || selectedCountry === 'GB' || selectedCountry === 'BE') && !selectedRegion) {
      toast({
        title: "Region required",
        description: `Please select your ${selectedCountry === 'DE' ? 'state' : 'region'}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          country_code: selectedCountry,
          region_code: selectedRegion || null,
        })
        .eq('user_id', user!.id);

      if (error) throw error;

      // Import holidays
      try {
        const regionToImport = (selectedCountry === 'DE' || selectedCountry === 'GB' || selectedCountry === 'BE') ? selectedRegion : null;
        await importHolidaysForYears(selectedCountry, regionToImport);
      } catch (importError) {
        console.error('Error importing holidays:', importError);
        // Don't block the user flow - holidays can be imported later
      }

      toast({
        title: "Location set successfully",
        description: "Your shift times will now be based on your location",
      });

      onComplete();
    } catch (error) {
      console.error('Error setting location:', error);
      toast({
        title: "Error",
        description: "Failed to update location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md" 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <DialogTitle>Set Your Location</DialogTitle>
          </div>
          <DialogDescription>
            Please select your country to ensure accurate shift times and holiday information.
            This is required to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="country">Country *</Label>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCountry === 'DE' && (
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select your state" />
                </SelectTrigger>
                <SelectContent>
                  {germanStates.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedCountry === 'GB' && (
            <div className="space-y-2">
              <Label htmlFor="region">Region *</Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger id="region">
                  <SelectValue placeholder="Select your region" />
                </SelectTrigger>
                <SelectContent>
                  {ukRegions.map((region) => (
                    <SelectItem key={region.code} value={region.code}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedCountry === 'BE' && (
            <div className="space-y-2">
              <Label htmlFor="region">Region *</Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger id="region">
                  <SelectValue placeholder="Select your region" />
                </SelectTrigger>
                <SelectContent>
                  {belgiumRegions.map((region) => (
                    <SelectItem key={region.code} value={region.code}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleComplete} disabled={loading || !selectedCountry}>
            {loading ? "Setting up..." : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
