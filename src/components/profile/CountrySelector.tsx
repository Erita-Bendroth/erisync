import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

const countries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'JP', name: 'Japan' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
];

const CountrySelector = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentCountry, setCurrentCountry] = useState('US');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserCountry();
  }, [user]);

  const fetchUserCountry = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('country_code')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data?.country_code) {
        setCurrentCountry(data.country_code);
      }
    } catch (error) {
      console.error('Error fetching user country:', error);
    }
  };

  const updateCountry = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ country_code: currentCountry })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Country preference updated successfully",
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Globe className="w-5 h-5 mr-2" />
          Country Preference
        </CardTitle>
        <CardDescription>
          Set your country to automatically import relevant public holidays
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
        
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Current: {getCountryName(currentCountry)}
          </p>
          <Button onClick={updateCountry} disabled={loading}>
            {loading ? "Updating..." : "Update Country"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CountrySelector;