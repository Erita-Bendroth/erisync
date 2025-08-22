import React, { useState, useEffect } from "react";
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
}

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
  { code: "XK", name: "Kosovo" }
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

  const fetchUserData = async () => {
    if (!user) return;
    
    try {
      // Fetch user roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      setUserRoles(rolesData?.map(r => r.role) || []);

      // Fetch user's country
      const { data: profileData } = await supabase
        .from('profiles')
        .select('country_code')
        .eq('user_id', user.id)
        .single();
      
      if (profileData?.country_code) {
        setUserCountry(profileData.country_code);
        setSelectedCountry(profileData.country_code);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const isPlanner = () => userRoles.includes('planner');
  const isAdmin = () => userRoles.includes('admin');

  const fetchHolidays = async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('holidays')
        .select('*');

      // For regular users (non-planners/non-admins), only show public holidays for their country
      if (!isPlanner() && !isAdmin()) {
        if (userCountry) {
          query = query
            .eq('country_code', userCountry)
            .eq('is_public', true)
            .is('user_id', null); // Public holidays have null user_id
        } else {
          // If no country set, show no holidays
          query = query.eq('id', 'non-existent'); // This will return empty results
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
  };

  const importHolidays = async () => {
    if (!user) return;
    
    // For regular users, restrict import to their country only
    if (!isPlanner() && !isAdmin()) {
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
          user_id: user.id
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
  };

  const deleteHolidays = async (countryCode: string, year: number) => {
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
  };

  const getCountryName = (code: string) => {
    return countries.find(c => c.code === code)?.name || code;
  };

  const groupedHolidays = holidays.reduce((acc, holiday) => {
    const key = `${holiday.country_code}-${holiday.year}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(holiday);
    return acc;
  }, {} as Record<string, Holiday[]>);

  const currentYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);

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
          {!isPlanner() && !isAdmin() && (
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
                disabled={!isPlanner() && !isAdmin()}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(isPlanner() || isAdmin() ? countries : countries.filter(c => c.code === userCountry)).map((country) => (
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
              disabled={loading || (!isPlanner() && !isAdmin() && !userCountry)}
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
            {isPlanner() || isAdmin() 
              ? "Manage your imported public holidays by country and year"
              : `View public holidays for ${getCountryName(userCountry || 'your country')}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.keys(groupedHolidays).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {!isPlanner() && !isAdmin() && !userCountry 
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
                      {(isPlanner() || isAdmin()) && (
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
                            </p>
                          </div>
                          {holiday.is_public && (
                            <Badge variant="secondary" className="text-xs">
                              Public
                            </Badge>
                          )}
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