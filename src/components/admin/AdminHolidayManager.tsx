import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

const AdminHolidayManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('DE');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchUserRoles();
      fetchHolidays();
    }
  }, [user]);

  const fetchUserRoles = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      setUserRoles(data?.map(r => r.role) || []);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  }, [user]);

  const isPlanner = useMemo(() => userRoles.includes('planner'), [userRoles]);
  const isAdmin = useMemo(() => userRoles.includes('admin'), [userRoles]);
  const hasPermission = useMemo(() => isPlanner || isAdmin, [isPlanner, isAdmin]);

  const fetchHolidays = useCallback(async () => {
    if (!user || !hasPermission) return;
    
    try {
      // Fetch all centrally managed holidays (user_id is null) - only select needed fields
      const { data, error } = await supabase
        .from('holidays')
        .select('id, name, date, country_code, year, is_public, region_code')
        .is('user_id', null) // Only centrally managed holidays
        .eq('is_public', true)
        .order('date', { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  }, [user, hasPermission]);

  const triggerHolidayAutoAssignment = useCallback(async () => {
    try {
      await supabase.functions.invoke('auto-assign-holidays', {
        body: { triggered_by: 'manual_import' }
      });
    } catch (error) {
      console.error('Error triggering holiday auto-assignment:', error);
      // Don't show error to user as this is a background process
    }
  }, []);

  const importHolidays = useCallback(async () => {
    if (!user || !hasPermission) return;

    setLoading(true);
    try {
      // For Germany, if specific regions are selected, import for each region
      // Otherwise import national holidays only
      const regionsToImport = selectedCountry === 'DE' && selectedRegions.length > 0 
        ? selectedRegions 
        : [null];

      let totalImported = 0;
      let totalExisting = 0;

      for (const region of regionsToImport) {
        const { data, error } = await supabase.functions.invoke('import-holidays', {
          body: {
            country_code: selectedCountry,
            year: selectedYear,
            user_id: null, // Store as centrally managed holidays
            region_code: region
          }
        });

        if (error) throw error;
        
        totalImported += data.imported || 0;
        totalExisting += data.existing || 0;
      }

      toast({
        title: "Success",
        description: totalImported > 0 
          ? `Imported ${totalImported} holidays for ${selectedYear}${selectedRegions.length > 0 ? ` (${selectedRegions.length} regions)` : ''}. Auto-assignment is running in the background.`
          : `All holidays for ${selectedYear} already exist (${totalExisting} holidays)`,
      });

      fetchHolidays();
      
      // Trigger auto-assignment in the background (non-blocking)
      triggerHolidayAutoAssignment().catch(err => {
        console.error('Background auto-assignment error:', err);
      });
      
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
  }, [user, hasPermission, selectedCountry, selectedYear, selectedRegions, toast, fetchHolidays, triggerHolidayAutoAssignment]);

  const deleteHolidays = useCallback(async (countryCode: string, year: number) => {
    if (!user || !hasPermission) return;
    
    try {
      // Delete centrally managed holidays
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('country_code', countryCode)
        .eq('year', year)
        .is('user_id', null); // Only centrally managed holidays

      if (error) throw error;

      toast({
        title: "Success",
        description: `Deleted centrally managed holidays for ${countryCode} ${year}`,
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
  }, [user, hasPermission, toast, fetchHolidays]);

  const getCountryName = useCallback((code: string) => {
    return countries.find(c => c.code === code)?.name || code;
  }, []);

  const getRegions = useCallback(() => {
    return countries.find(c => c.code === selectedCountry)?.regions || [];
  }, [selectedCountry]);

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

  // Group holidays by date and name to consolidate regional variants
  const consolidateRegionalHolidays = useCallback((holidayList: Holiday[]) => {
    const consolidated = new Map<string, Holiday & { regions?: string[] }>();
    
    holidayList.forEach(holiday => {
      const key = `${holiday.date}-${holiday.name}`;
      const existing = consolidated.get(key);
      
      if (existing) {
        // Add region to existing holiday
        if (holiday.region_code) {
          existing.regions = [...(existing.regions || []), holiday.region_code];
        }
      } else {
        // Create new entry
        consolidated.set(key, {
          ...holiday,
          regions: holiday.region_code ? [holiday.region_code] : undefined
        });
      }
    });
    
    return Array.from(consolidated.values());
  }, []);

  const currentYears = useMemo(() => 
    Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i),
    []
  );

  if (!hasPermission) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only administrators and planners can manage centralized holidays.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Central Holiday Management
          </CardTitle>
          <CardDescription>
            Import holidays once per country/region. Users automatically receive holidays based on their profile location.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Holidays imported here are automatically assigned to users based on their country and region settings. 
              Users do not need to manually import holidays - they receive them automatically based on their location profile.
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">Country</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
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
            
            {selectedCountry === 'DE' && (
              <div className="flex-1">
                <label className="text-sm font-medium">
                  Regions (Optional) - {selectedRegions.length > 0 ? `${selectedRegions.length} selected` : 'Select regions'}
                </label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto bg-background">
                  <div className="space-y-2">
                    {getRegions().map((region) => (
                      <label key={region.code} className="flex items-center space-x-2 cursor-pointer hover:bg-accent/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(region.code)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRegions([...selectedRegions, region.code]);
                            } else {
                              setSelectedRegions(selectedRegions.filter(r => r !== region.code));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{region.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
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
            
            <Button onClick={importHolidays} disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              {loading ? "Importing..." : "Import Holidays"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Centrally Managed Holidays</CardTitle>
          <CardDescription>
            Public holidays available to all users based on their location settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.keys(groupedHolidays).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No holidays imported yet. Use the import tool above to get started.
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
                          {holidayGroup.length} public holidays available to users
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteHolidays(countryCode, parseInt(year))}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {consolidateRegionalHolidays(holidayGroup).map((holiday) => (
                        <div key={holiday.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{holiday.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(holiday.date), 'MMM dd, yyyy')}
                            </p>
                            {holiday.regions && holiday.regions.length > 0 && countryCode === 'DE' && (
                              <p className="text-xs text-blue-600 mt-1">
                                Regions: {holiday.regions.sort().join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary" className="text-xs">
                              Public
                            </Badge>
                            {holiday.regions && holiday.regions.length > 0 && (
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

export default AdminHolidayManager;