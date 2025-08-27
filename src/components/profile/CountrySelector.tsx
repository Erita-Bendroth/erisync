import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

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

const CountrySelector = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentCountry, setCurrentCountry] = useState('DE'); // Default to Germany to show the region selector
  const [currentRegion, setCurrentRegion] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserCountry();
  }, [user]);

  const fetchUserCountry = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('country_code, region_code')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data?.country_code) {
        setCurrentCountry(data.country_code);
      }
      if (data?.region_code) {
        setCurrentRegion(data.region_code);
      }
    } catch (error) {
      console.error('Error fetching user country:', error);
    }
  };

  const updateCountry = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const updateData: { country_code: string; region_code?: string | null } = {
        country_code: currentCountry
      };
      
      // Only include region for Germany, clear for other countries
      if (currentCountry === 'DE') {
        updateData.region_code = currentRegion || null;
      } else {
        updateData.region_code = null;
        setCurrentRegion(''); // Clear region when switching away from Germany
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: currentCountry === 'DE' && currentRegion 
          ? "Country and region preferences updated successfully" 
          : "Country preference updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating country:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update country",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCountryName = (code: string) => {
    return countries.find(c => c.code === code)?.name || code;
  };

  const getRegionName = (code: string) => {
    return germanStates.find(s => s.code === code)?.name || code;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Globe className="w-5 h-5 mr-2" />
          Location Preferences
        </CardTitle>
        <CardDescription>
          Set your country and region for accurate holiday scheduling
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Country</label>
          <Select value={currentCountry} onValueChange={setCurrentCountry}>
            <SelectTrigger>
              <SelectValue />
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

        {currentCountry === 'DE' && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              German State (Bundesland)
            </label>
            <Select value={currentRegion} onValueChange={setCurrentRegion}>
              <SelectTrigger>
                <SelectValue placeholder="Select your state..." />
              </SelectTrigger>
              <SelectContent>
                {germanStates.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This helps ensure region-specific holidays like Reformationstag, Fronleichnam, and Allerheiligen are correctly applied.
            </p>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            <p>Country: {getCountryName(currentCountry)}</p>
            {currentCountry === 'DE' && currentRegion && (
              <p>State: {getRegionName(currentRegion)}</p>
            )}
          </div>
          <Button onClick={updateCountry} disabled={loading}>
            {loading ? "Updating..." : "Update Location"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CountrySelector;