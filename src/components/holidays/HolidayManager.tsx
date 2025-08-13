import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

const HolidayManager = () => {
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const importHolidays = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-holidays', {
        body: {
          country_code: selectedCountry,
          year: selectedYear
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Imported ${data.imported} holidays for ${selectedYear}`,
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
    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('country_code', countryCode)
        .eq('year', year);

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
          <CardTitle>Imported Holidays</CardTitle>
          <CardDescription>
            Manage your imported public holidays by country and year
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
                          {holidayGroup.length} holidays imported
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