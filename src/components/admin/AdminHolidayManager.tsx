import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Download, Trash2, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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

interface ImportStatus {
  id: string;
  country_code: string;
  year: number;
  region_code: string | null;
  status: 'pending' | 'completed' | 'failed';
  imported_count: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
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
  const [importStatuses, setImportStatuses] = useState<ImportStatus[]>([]);

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
    
    console.log(`🔍 Admin Holiday Manager - Fetching holidays for admin/planner`);
    
    try {
      // Fetch all centrally managed holidays (user_id is null) - only select needed fields
      const { data, error } = await supabase
        .from('holidays')
        .select('id, name, date, country_code, year, is_public, region_code')
        .is('user_id', null) // Only centrally managed holidays
        .eq('is_public', true)
        .order('date', { ascending: true });

      if (error) throw error;
      
      console.log(`📅 Fetched ${data?.length || 0} centrally managed holidays`);
      
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  }, [user, hasPermission]);

  const fetchImportStatuses = useCallback(async () => {
    if (!user || !hasPermission) {
      console.log('⚠️ fetchImportStatuses skipped - user:', !!user, 'hasPermission:', hasPermission);
      return;
    }
    
    console.log('🔄 Fetching import statuses... (forced fresh query)');
    try {
      const { data, error } = await supabase
        .from('holiday_import_status')
        .select('*')
        .order('started_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching import statuses:', error);
        throw error;
      }
      
      console.log('📊 Import statuses fetched:', data?.length || 0, 'records');
      
      // Log Austria 2026 specifically
      const austriaStatus = data?.filter(d => d.country_code === 'AT' && d.year === 2026);
      console.log('🇦🇹 Austria 2026 status in DB:', austriaStatus);
      
      console.log('💾 Setting importStatuses state with:', data?.length, 'records');
      setImportStatuses((data || []) as ImportStatus[]);
      
      console.log('✅ importStatuses state updated');
    } catch (error) {
      console.error('❌ Error fetching import statuses:', error);
    }
  }, [user, hasPermission]);

  useEffect(() => {
    if (user) {
      fetchUserRoles();
    }
  }, [user, fetchUserRoles]);

  useEffect(() => {
    console.log('🎯 Main useEffect triggered - user:', !!user, 'hasPermission:', hasPermission);
    
    if (user && hasPermission) {
      console.log('✅ Calling initial fetch functions...');
      fetchHolidays();
      fetchImportStatuses();
      
      // Set up realtime subscription for import status updates
      console.log('🔔 Setting up realtime subscription for holiday_import_status');
      const channel = supabase
        .channel('holiday-import-status-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'holiday_import_status'
          },
          (payload) => {
            console.log('⚡ Realtime update received:', payload);
            fetchImportStatuses();
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              fetchHolidays();
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Realtime subscription status:', status);
        });
      
      return () => {
        console.log('🔕 Cleaning up realtime subscription');
        supabase.removeChannel(channel);
      };
    } else {
      console.log('⚠️ Skipping setup - missing user or permissions');
    }
  }, [user, hasPermission, fetchHolidays, fetchImportStatuses]);

  const getImportStatus = useCallback((countryCode: string, year: number, regionCode?: string | null) => {
    return importStatuses.find(
      s => s.country_code === countryCode && 
           s.year === year && 
           s.region_code === (regionCode || null)
    );
  }, [importStatuses]);

  const hasAnyImportForCountryYear = useCallback((countryCode: string, year: number) => {
    return importStatuses.some(
      s => s.country_code === countryCode && s.year === year
    );
  }, [importStatuses]);

  const getCountryYearStatus = useCallback((countryCode: string, year: number): 'completed' | 'pending' | 'none' => {
    const statuses = importStatuses.filter(
      s => s.country_code === countryCode && s.year === year
    );
    
    if (statuses.length === 0) return 'none';
    if (statuses.some(s => s.status === 'pending')) return 'pending';
    // If all imports are completed or failed (i.e., finished), show as completed
    if (statuses.every(s => s.status === 'completed' || s.status === 'failed')) return 'completed';
    return 'none';
  }, [importStatuses]);

  // Check for timed out imports and mark them as failed
  const checkTimedOutImports = useCallback(async () => {
    const TIMEOUT_MINUTES = 15;
    const now = new Date();
    
    for (const status of importStatuses) {
      if (status.status === 'pending') {
        const startedAt = new Date(status.started_at);
        const minutesElapsed = (now.getTime() - startedAt.getTime()) / (1000 * 60);
        
        if (minutesElapsed > TIMEOUT_MINUTES) {
          console.log(`⏰ Import timed out: ${status.country_code} ${status.year} (${minutesElapsed.toFixed(0)} minutes elapsed)`);
          
          try {
            await supabase
              .from('holiday_import_status')
              .update({
                status: 'failed',
                error_message: `Import timed out - reset for retry`,
                completed_at: new Date().toISOString()
              })
              .eq('id', status.id);
            
            toast({
              title: "Import Timeout",
              description: `${status.country_code} ${status.year} import timed out and was reset. Please try again.`,
              variant: "destructive"
            });
          } catch (error) {
            console.error('Error updating timed out import:', error);
          }
        }
      }
    }
  }, [importStatuses, toast]);

  useEffect(() => {
    // Check for timed out imports on mount and when statuses change
    checkTimedOutImports();
  }, [checkTimedOutImports]);

  useEffect(() => {
    // Poll for status updates while imports are pending
    const hasPending = importStatuses.some(s => s.status === 'pending');
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchImportStatuses();
      fetchHolidays();
    }, 3000);

    return () => clearInterval(interval);
  }, [importStatuses, fetchImportStatuses, fetchHolidays]);

  const triggerHolidayAutoAssignment = useCallback(async () => {
    // Holidays are now displayed directly from holidays table - no need to create schedule entries
    console.log('Holidays are automatically displayed from holidays table');
  }, []);

  const importHolidays = useCallback(async () => {
    if (!user || !hasPermission) return;

    console.log(`🚀 Importing holidays:`, {
      country: selectedCountry,
      year: selectedYear,
      regions: selectedRegions.length > 0 ? selectedRegions : ['National']
    });

    setLoading(true);
    try {
      // For Germany, if specific regions are selected, import for each region
      // Otherwise import national holidays only
      const regionsToImport = selectedCountry === 'DE' && selectedRegions.length > 0 
        ? selectedRegions 
        : [null];

      let totalImported = 0;
      let totalExisting = 0;
      let totalPending = 0;

      // Optimistically add pending status to state immediately
      const newPendingStatuses: ImportStatus[] = regionsToImport
        .filter(region => !getImportStatus(selectedCountry, selectedYear, region))
        .map(region => ({
          id: `temp-${Date.now()}-${region || 'national'}`,
          country_code: selectedCountry,
          year: selectedYear,
          region_code: region,
          status: 'pending' as const,
          imported_count: 0,
          started_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
        }));
      
      setImportStatuses(prev => [...prev, ...newPendingStatuses]);

      for (const region of regionsToImport) {
        // Check if already imported or in progress
        const existingStatus = getImportStatus(selectedCountry, selectedYear, region);
        if (existingStatus?.status === 'pending' && !existingStatus.id.startsWith('temp-')) {
          totalPending++;
          continue;
        }

        const { data, error } = await supabase.functions.invoke('import-holidays', {
          body: {
            country_code: selectedCountry,
            year: selectedYear,
            user_id: null, // Store as centrally managed holidays
            region_code: region
          }
        });

        if (error) {
          // Check if it's a conflict error (409)
          if (error.message?.includes('already in progress')) {
            totalPending++;
            continue;
          }
          throw error;
        }
        
        console.log(`📥 Import result for region ${region || 'National'}:`, {
          imported: data.imported,
          existing: data.existing
        });
        
        totalImported += data.imported || 0;
        totalExisting += data.existing || 0;
      }

      console.log(`✅ Import complete:`, {
        totalImported,
        totalExisting,
        totalPending,
        regionsCount: selectedRegions.length
      });

      // Refresh statuses immediately
      await fetchImportStatuses();

      toast({
        title: "Success",
        description: totalPending > 0
          ? `${totalPending} import(s) already in progress. Data is syncing in the background.`
          : totalImported > 0
          ? `Imported ${totalImported} holidays for ${selectedYear}${selectedRegions.length > 0 ? ` (${selectedRegions.length} regions)` : ''}. They will automatically appear for users based on their location.`
          : `All holidays for ${selectedYear} already exist (${totalExisting} holidays)`,
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
  }, [user, hasPermission, selectedCountry, selectedYear, selectedRegions, toast, fetchHolidays, fetchImportStatuses, getImportStatus]);

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

  const resetImportStatus = useCallback(async (countryCode: string, year: number, regionCode?: string | null) => {
    if (!user || !hasPermission) return;
    
    try {
      const { error } = await supabase
        .from('holiday_import_status')
        .update({
          status: 'failed',
          error_message: 'Manually reset by admin',
          completed_at: new Date().toISOString()
        })
        .eq('country_code', countryCode)
        .eq('year', year)
        .eq('region_code', regionCode || null);

      if (error) throw error;

      toast({
        title: "Import Reset",
        description: `Import status reset for ${getCountryName(countryCode)} ${year}. You can now retry the import.`
      });

      fetchImportStatuses();
    } catch (error: any) {
      console.error('Error resetting import status:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset import status",
        variant: "destructive"
      });
    }
  }, [user, hasPermission, toast, fetchImportStatuses]);

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
              <strong>Important:</strong> Holidays imported here automatically appear for users based on their country and region settings. 
              They display as informational badges in the schedule view, NOT as shifts.
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
                  {countries.map((country) => {
                    const countryStatus = getCountryYearStatus(country.code, selectedYear);
                    return (
                      <SelectItem key={country.code} value={country.code}>
                        <div className="flex items-center gap-2">
                          <span>{country.name}</span>
                          {countryStatus === 'completed' && (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          )}
                          {countryStatus === 'pending' && (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
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
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={importHolidays} 
                    disabled={loading || (() => {
                      const regionsToCheck = selectedCountry === 'DE' && selectedRegions.length > 0 
                        ? selectedRegions 
                        : [null];
                      return regionsToCheck.some(region => 
                        getImportStatus(selectedCountry, selectedYear, region)?.status === 'pending'
                      );
                    })()}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {loading ? "Importing..." : "Import Holidays"}
                  </Button>
                </TooltipTrigger>
                {(() => {
                  const regionsToCheck = selectedCountry === 'DE' && selectedRegions.length > 0 
                    ? selectedRegions 
                    : [null];
                  const pendingImport = regionsToCheck.find(region => 
                    getImportStatus(selectedCountry, selectedYear, region)?.status === 'pending'
                  );
                  return pendingImport && (
                    <TooltipContent>
                      <p>Import already in progress. Holidays are syncing in the background.</p>
                    </TooltipContent>
                  );
                })()}
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Centrally Managed Holidays</CardTitle>
              <CardDescription>
                Public holidays available to all users based on their location settings
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchImportStatuses();
                fetchHolidays();
                toast({ title: "Refreshed", description: "Status and holidays updated" });
              }}
            >
              🔄 Refresh Status
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Show pending imports */}
          {(() => {
            const pendingStatuses = importStatuses.filter(s => s.status === 'pending');
            console.log('🔍 Rendering - Total import statuses:', importStatuses.length);
            console.log('🔍 Rendering - Pending statuses:', pendingStatuses.length, pendingStatuses);
            console.log('🔍 Rendering - All Austria statuses:', importStatuses.filter(s => s.country_code === 'AT' && s.year === 2026));
            
            if (pendingStatuses.length === 0) return null;
            
            return (
              <Alert className="mb-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>Syncing in progress:</strong> {pendingStatuses.length} import(s) running in the background. 
                      The page will automatically refresh when complete.
                    </div>
                    <div className="flex flex-wrap gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          fetchImportStatuses();
                          fetchHolidays();
                          toast({ title: "Refreshed", description: "Status updated" });
                        }}
                      >
                        Force Refresh
                      </Button>
                      {pendingStatuses.map(status => {
                        const startedAt = new Date(status.started_at);
                        const minutesElapsed = (new Date().getTime() - startedAt.getTime()) / (1000 * 60);
                        const isStuck = minutesElapsed > 15;
                        
                        return (
                          <Button
                            key={status.id}
                            variant="outline"
                            size="sm"
                            onClick={() => resetImportStatus(status.country_code, status.year, status.region_code)}
                            className={isStuck ? "border-destructive text-destructive" : ""}
                          >
                            Reset {getCountryName(status.country_code)} {status.year}
                            {isStuck && " (Stuck)"}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            );
          })()}
          
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
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">
                            {getCountryName(countryCode)} {year}
                          </h3>
                          {(() => {
                            const countryStatus = getCountryYearStatus(countryCode, parseInt(year));
                            if (countryStatus === 'pending') {
                              const pendingStatuses = importStatuses.filter(
                                s => s.country_code === countryCode && s.year === parseInt(year) && s.status === 'pending'
                              );
                              const oldestStatus = pendingStatuses[0];
                              const startedAt = oldestStatus ? new Date(oldestStatus.started_at) : new Date();
                              const minutesElapsed = (new Date().getTime() - startedAt.getTime()) / (1000 * 60);
                              const isStuck = minutesElapsed > 15;
                              
                              return (
                                <div className="flex items-center gap-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className={`gap-1 ${isStuck ? 'border-destructive text-destructive' : ''}`}>
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          Syncing {isStuck && '(Stuck)'}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          {isStuck 
                                            ? `Import stuck for ${Math.floor(minutesElapsed)} minutes. Click reset to retry.`
                                            : 'Holidays are being imported in the background'}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  {isStuck && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => resetImportStatus(countryCode, parseInt(year), null)}
                                      className="h-6 px-2 text-xs"
                                    >
                                      Reset
                                    </Button>
                                  )}
                                </div>
                              );
                            }
                            if (countryStatus === 'completed' || holidayGroup.length > 0) {
                              return (
                                <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Imported
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
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