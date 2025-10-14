import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Holiday {
  id: string;
  name: string;
  date: string;
  country_code: string;
  year: number;
  is_public: boolean;
  region_code?: string;
}

// European countries with focus on Germany and regional support
const countries = [
  { code: "DE", name: "Germany", regions: [
    { code: "BW", name: "Baden-Württemberg" },
    { code: "BY", name: "Bavaria (Bayern)" },
    { code: "BE", name: "Berlin" },
    { code: "BB", name: "Brandenburg" },
    { code: "HB", name: "Bremen" },
    { code: "HH", name: "Hamburg" },
    { code: "HE", name: "Hesse (Hessen)" },
    { code: "MV", name: "Mecklenburg-Vorpommern" },
    { code: "NI", name: "Lower Saxony (Niedersachsen)" },
    { code: "NW", name: "North Rhine-Westphalia (Nordrhein-Westfalen)" },
    { code: "RP", name: "Rhineland-Palatinate (Rheinland-Pfalz)" },
    { code: "SL", name: "Saarland" },
    { code: "SN", name: "Saxony (Sachsen)" },
    { code: "ST", name: "Saxony-Anhalt (Sachsen-Anhalt)" },
    { code: "SH", name: "Schleswig-Holstein" },
    { code: "TH", name: "Thuringia (Thüringen)" }
  ]},
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "NO", name: "Norway" },
  { code: "IS", name: "Iceland" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" }
];

const HolidayManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('DE'); // Default to Germany
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userCountry, setUserCountry] = useState<string>('');
  const [userRegion, setUserRegion] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  useEffect(() => {
    if (user && userRoles.length > 0) {
      fetchHolidays();
    }
  }, [user, userRoles, userCountry]);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch both user roles and profile in parallel
      const [rolesResponse, profileResponse] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id),
        supabase
          .from('profiles')
          .select('country_code, region_code')
          .eq('user_id', user.id)
          .single()
      ]);
      
      setUserRoles(rolesResponse.data?.map(r => r.role) || []);
      
      if (profileResponse.data?.country_code) {
        setUserCountry(profileResponse.data.country_code);
        setSelectedCountry(profileResponse.data.country_code);
      }
      if (profileResponse.data?.region_code) {
        setUserRegion(profileResponse.data.region_code);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, [user]);

  const isPlanner = useMemo(() => userRoles.includes('planner'), [userRoles]);
  const isAdmin = useMemo(() => userRoles.includes('admin'), [userRoles]);

  const fetchHolidays = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('holidays')
        .select('id, name, date, country_code, year, is_public, region_code'); // Only select needed fields

      // For regular users (non-planners/non-admins), only show public holidays for their country and region
      if (!isPlanner && !isAdmin) {
        if (userCountry) {
          query = query
            .eq('country_code', userCountry)
            .eq('is_public', true)
            .is('user_id', null); // Public holidays have null user_id
          
          // For Germany, also filter by region for regional holidays
          if (userCountry === 'DE' && userRegion) {
            // Show both national holidays (no region) and regional holidays for user's region
            query = query.or(`region_code.is.null,region_code.eq.${userRegion}`);
          }
        } else {
          // If no country set, return empty array immediately
          setHolidays([]);
          return;
        }
      } else {
        // For planners/admins, show holidays they have imported
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('date', { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  }, [user, isPlanner, isAdmin, userCountry, userRegion]);

  const importHolidays = useCallback(async () => {
    if (!user) return;
    
    // For regular users, restrict import to their country only
    if (!isPlanner && !isAdmin) {
      if (!userCountry) {
        toast({
          title: "Country Required",
          description: "Please set your country in Settings before importing holidays",
          variant: "destructive",
        });
        return;
      }
      
      if (selectedCountry !== userCountry) {
        toast({
          title: "Access Restricted",
          description: "You can only import holidays for your assigned country",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-holidays', {
        body: {
          country_code: selectedCountry,
          year: selectedYear,
          user_id: user.id,
          region_code: selectedCountry === 'DE' ? userRegion : null
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.imported > 0 
          ? `Imported ${data.imported} holidays for ${selectedYear}`
          : `All holidays for ${selectedYear} already exist (${data.existing} holidays)`,
      });

      fetchHolidays();
    } catch (error: any) {
      console.error('Error importing holidays:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to import holidays",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, isPlanner, isAdmin, userCountry, selectedCountry, selectedYear, userRegion, toast, fetchHolidays]);

  const deleteHolidays = useCallback(async (countryCode: string, year: number) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('country_code', countryCode)
        .eq('year', year)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Deleted holidays for ${countryCode} ${year}`,
      });

      fetchHolidays();
    } catch (error: any) {
      console.error('Error deleting holidays:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete holidays",
        variant: "destructive",
      });
    }
  }, [user, toast, fetchHolidays]);

  const getCountryName = useCallback((code: string) => {
    return countries.find(c => c.code === code)?.name || code;
  }, []);

  const groupedHolidays = useMemo(() => {
    return holidays.reduce((acc, holiday) => {
      const key = `${holiday.country_code}-${holiday.year}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(holiday);
      return acc;
    }, {} as Record<string, Holiday[]>);
  }, [holidays]);

  const currentYears = useMemo(() => 
    Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i),
    []
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Holiday Management
          </CardTitle>
          <CardDescription>
            Import public holidays automatically by country
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isPlanner && !isAdmin && (
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                You can only view and import holidays for your assigned country: <strong>{getCountryName(userCountry || 'Unknown')}</strong>
              </p>
              {!userCountry && (
                <p className="text-sm text-destructive mt-2">
                  Please set your country in Settings to access holiday management.
                </p>
              )}
            </div>
          )}
          
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">Country</label>
              <Select 
                value={selectedCountry} 
                onValueChange={setSelectedCountry}
                disabled={!isPlanner && !isAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(isPlanner || isAdmin ? countries : countries.filter(c => c.code === userCountry)).map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Year</label>
              <Select value={selectedYear.toString()} onValueChange={(year) => setSelectedYear(parseInt(year))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={importHolidays} 
              disabled={loading || (!isPlanner && !isAdmin && !userCountry)}
            >
              <Download className="w-4 h-4 mr-2" />
              {loading ? "Importing..." : "Import Holidays"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imported Holidays</CardTitle>
          <CardDescription>
            {isPlanner || isAdmin 
              ? "Manage your imported public holidays by country and year"
              : `View public holidays for ${getCountryName(userCountry || 'your country')}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.keys(groupedHolidays).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {!isPlanner && !isAdmin && !userCountry 
                  ? "Please set your country in Settings to view holidays."
                  : "No holidays available yet. Use the import tool above to get started."
                }
              </p>
            ) : (
              Object.entries(groupedHolidays).map(([key, holidayGroup]) => {
                const [countryCode, year] = key.split('-');
                return (
                  <div key={key} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {getCountryName(countryCode)} {year}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {holidayGroup.length} holidays imported
                        </p>
                      </div>
                      {(isPlanner || isAdmin) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteHolidays(countryCode, parseInt(year))}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {holidayGroup.map((holiday) => (
                        <div key={holiday.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium text-sm">{holiday.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(holiday.date), 'MMM dd, yyyy')}
                              {holiday.region_code && countryCode === 'DE' && (
                                <span className="ml-2 text-xs text-blue-600">
                                  ({holiday.region_code})
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {holiday.is_public && (
                              <Badge variant="secondary" className="text-xs">
                                Public
                              </Badge>
                            )}
                            {holiday.region_code && (
                              <Badge variant="outline" className="text-xs">
                                Regional
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HolidayManager;