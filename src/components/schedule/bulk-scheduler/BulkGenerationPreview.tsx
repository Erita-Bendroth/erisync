import { format, isWeekend, eachDayOfInterval } from "date-fns";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Calendar, Users } from "lucide-react";
import { useShiftTypes } from "@/hooks/useShiftTypes";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { 
  fetchTeamShiftDefinitions, 
  generateDayPreviews, 
  type DayShiftPreview,
  type ShiftTimeDefinition 
} from "@/lib/previewShiftSelection";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { matchesCountryCode } from "@/lib/countryCodeUtils";

interface BulkGenerationPreviewProps {
  totalShifts: number;
  workDays: number;
  userCount: number;
  startDate: Date | null;
  endDate: Date | null;
  shiftType: string | null;
  teamId: string | null;
  autoDetectWeekends: boolean;
  autoDetectHolidays: boolean;
  weekendShiftOverride?: string | null;
  selectedUserIds?: string[];
  mode?: 'users' | 'team' | 'rotation';
  excludedDays?: number[];
}

export const BulkGenerationPreview = ({
  totalShifts,
  workDays,
  userCount,
  startDate,
  endDate,
  shiftType,
  teamId,
  autoDetectWeekends,
  autoDetectHolidays,
  weekendShiftOverride,
  selectedUserIds = [],
  mode = 'users',
  excludedDays = [],
}: BulkGenerationPreviewProps) => {
  const { shiftTypes } = useShiftTypes(teamId ? [teamId] : []);
  const selectedShift = shiftTypes.find(s => s.type === shiftType);
  const [allShifts, setAllShifts] = useState<ShiftTimeDefinition[]>([]);
  const [dayPreviews, setDayPreviews] = useState<DayShiftPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [userBreakdown, setUserBreakdown] = useState<Array<{
    userId: string;
    userName: string;
    countryCode: string;
    shifts: Array<{ type: string; description: string; count: number; times: string }>;
  }>>([]);

  // Fetch shift definitions when team changes
  useEffect(() => {
    if (!teamId) return;
    
    const loadShifts = async () => {
      setLoading(true);
      const shifts = await fetchTeamShiftDefinitions(teamId);
      setAllShifts(shifts);
      setLoading(false);
    };
    
    loadShifts();
  }, [teamId]);

  // Fetch user information and generate breakdown
  useEffect(() => {
    if (!selectedUserIds || selectedUserIds.length === 0 || !startDate || !endDate || !teamId) {
      setUserBreakdown([]);
      return;
    }

    const generateUserBreakdown = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, country_code')
        .in('user_id', selectedUserIds);

      if (!profiles || allShifts.length === 0) return;

      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const breakdown: typeof userBreakdown = [];

      for (const profile of profiles) {
        const userCountry = profile.country_code || 'US';
        const shiftCounts = new Map<string, { type: string; description: string; count: number; times: string }>();

        for (const day of days) {
          const isWeekendDay = isWeekend(day);
          const dayOfWeek = day.getDay();
          
          // Skip excluded days
          if (excludedDays && excludedDays.includes(dayOfWeek)) continue;
          
          const shouldUseWeekend = autoDetectWeekends && isWeekendDay;

          // Find applicable shift
          let applicableShift = null;
          
          if (shouldUseWeekend) {
            // When weekend detection is ON, look for weekend shifts
            if (weekendShiftOverride) {
              // Use the specified weekend shift override
              applicableShift = allShifts.find(s => s.id === weekendShiftOverride);
            } else {
              // Auto-find a weekend shift for this user's country
              const weekendShifts = allShifts.filter(s => 
                s.shift_type === 'weekend' &&
                (!s.day_of_week || s.day_of_week.includes(dayOfWeek)) &&
                (!s.country_codes || s.country_codes.length === 0 || matchesCountryCode(userCountry, s.country_codes))
              );
              
              // Prefer country-specific weekend shift, fallback to any weekend shift
              applicableShift = weekendShifts[0] || allShifts.find(s => s.shift_type === 'weekend');
              
              console.log(`🎉 [PREVIEW WEEKEND] User ${profile.first_name} (${userCountry}) on ${format(day, 'EEE MMM d')}:`, {
                isWeekend: true,
                weekendShiftsFound: weekendShifts.length,
                usingShift: applicableShift?.description || 'none',
                times: applicableShift ? `${applicableShift.start_time.slice(0, 5)}-${applicableShift.end_time.slice(0, 5)}` : 'N/A'
              });
            }
          }
          
          // If no weekend shift found (or not weekend), use the selected shift
          if (!applicableShift && shiftType) {
            // First find the selected shift to get its shift_type enum value
            const selectedShiftDef = allShifts.find(s => s.id === shiftType);
            
            if (selectedShiftDef) {
              // Now find country-specific shifts with the same shift_type enum
              const countryShifts = allShifts.filter(s => 
                s.shift_type === selectedShiftDef.shift_type &&
                (!s.day_of_week || s.day_of_week.includes(dayOfWeek)) &&
                (!s.country_codes || s.country_codes.length === 0 || matchesCountryCode(userCountry, s.country_codes))
              );
              
              // Prefer country-specific shift, fallback to selected shift
              applicableShift = countryShifts[0] || selectedShiftDef;
              
              console.log(`🔍 [PREVIEW] User ${profile.first_name} (${userCountry}) on ${format(day, 'EEE MMM d')}:`, {
                selectedShift: selectedShiftDef?.description || 'Unknown',
                countrySpecificFound: countryShifts.length > 0,
                usingShift: applicableShift?.description || 'Unknown',
                times: applicableShift ? `${applicableShift.start_time?.slice(0, 5)}-${applicableShift.end_time?.slice(0, 5)}` : 'N/A'
              });
            } else {
              // Fallback if selected shift ID not found
              applicableShift = allShifts.find(s => s.id === shiftType);
            }
          }

          if (applicableShift) {
            const key = `${applicableShift.shift_type}-${applicableShift.id}`;
            const existing = shiftCounts.get(key);
            if (existing) {
              existing.count++;
            } else {
              shiftCounts.set(key, {
                type: applicableShift.shift_type,
                description: applicableShift.description || applicableShift.shift_type,
                count: 1,
                times: `${applicableShift.start_time.slice(0, 5)}-${applicableShift.end_time.slice(0, 5)}`,
              });
            }
          }
        }

        breakdown.push({
          userId: profile.user_id,
          userName: `${profile.first_name} ${profile.last_name}`,
          countryCode: userCountry,
          shifts: Array.from(shiftCounts.values()),
        });
      }

      setUserBreakdown(breakdown);
    };

    generateUserBreakdown();
  }, [selectedUserIds, startDate, endDate, allShifts, shiftType, autoDetectWeekends, weekendShiftOverride, teamId, excludedDays]);

  // Generate day previews when configuration changes
  useEffect(() => {
    if (!startDate || !endDate || !shiftType || allShifts.length === 0) {
      setDayPreviews([]);
      return;
    }

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const previews = generateDayPreviews(
      days,
      shiftType,
      autoDetectWeekends,
      weekendShiftOverride || null,
      allShifts
    );
    setDayPreviews(previews);
    
    // Debug logging
    console.log('🎯 [PREVIEW COMPONENT] Preview generated:', {
      totalDays: previews.length,
      shiftType,
      autoDetectWeekends,
      shiftsAvailable: allShifts.length,
      weekendShifts: allShifts.filter(s => s.shift_type === 'weekend').length,
      firstFewPreviews: previews.slice(0, 3).map(p => ({
        date: format(p.date, 'EEE MMM d'),
        shift: p.description,
        times: `${p.startTime}-${p.endTime}`,
        isWeekend: p.isWeekend,
        isAlt: p.isAlternative
      }))
    });
  }, [startDate, endDate, shiftType, autoDetectWeekends, weekendShiftOverride, allShifts]);
  
  if (!startDate || !endDate || !shiftType) {
    return (
      <Card className="p-4 bg-muted/30">
        <div className="text-sm text-muted-foreground">
          Configure the settings above to see a preview
        </div>
      </Card>
    );
  }

  // Calculate weekend count
  const days = startDate && endDate ? eachDayOfInterval({ start: startDate, end: endDate }) : [];
  const weekendCount = days.filter(d => isWeekend(d)).length;
  
  // Show preview days for visual indication
  const previewDays = dayPreviews.slice(0, 14); // Show first 14 days max
  
  // Calculate unique shifts from user-specific breakdown
  const uniqueShifts = new Map<string, { description: string; count: number; times: string }>();
  userBreakdown.forEach(user => {
    user.shifts.forEach(shift => {
      const key = `${shift.description}-${shift.times}`;
      if (uniqueShifts.has(key)) {
        uniqueShifts.get(key)!.count += shift.count;
      } else {
        uniqueShifts.set(key, {
          description: shift.description,
          count: shift.count,
          times: shift.times
        });
      }
    });
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Preview</div>
        
        {/* Debug Panel */}
        <Collapsible>
          <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            Debug Info <ChevronDown className="h-3 w-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="absolute right-4 top-12 z-50 bg-popover border rounded-md p-3 shadow-lg text-xs space-y-2 max-w-md">
            <div><strong>Shifts fetched:</strong> {allShifts.length}</div>
            <div><strong>Auto-detect weekends:</strong> {autoDetectWeekends ? 'Yes' : 'No'}</div>
            <div><strong>Selected shift type:</strong> {shiftType}</div>
            <div><strong>Weekend shifts available:</strong> {allShifts.filter(s => s.shift_type === 'weekend').length}</div>
            <div className="border-t pt-2">
              <strong>All shift definitions:</strong>
              <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(allShifts.map(s => ({
                  type: s.shift_type,
                  desc: s.description,
                  times: `${s.start_time}-${s.end_time}`,
                  days: s.day_of_week
                })), null, 2)}
              </pre>
            </div>
            <div className="border-t pt-2">
              <strong>First 5 day previews:</strong>
              <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(dayPreviews.slice(0, 5).map(p => ({
                  date: format(p.date, 'EEE MMM d'),
                  shift: p.description,
                  times: `${p.startTime}-${p.endTime}`,
                  isWeekend: p.isWeekend,
                  isAlt: p.isAlternative
                })), null, 2)}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      
      {/* User-specific breakdown */}
      {userBreakdown.length > 0 && (
        <div className="space-y-3 pt-3 border-t">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Shifts in this schedule:
          </h3>
          {userBreakdown.map((user) => (
            <div key={user.userId} className="space-y-1 pl-6">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{user.userName}</span>
                <Badge variant="outline" className="text-xs">
                  {user.countryCode}
                </Badge>
              </div>
              {user.shifts.map((shift, idx) => (
                <div key={idx} className="text-sm text-muted-foreground pl-4">
                  • {shift.description} <span className="font-mono text-xs">{shift.times}</span>{' '}
                  <span className="text-xs">({shift.count} days)</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Period:</span>
          <span className="font-medium">
            {format(startDate, "MMM dd")} - {format(endDate, "MMM dd, yyyy")}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Working days:</span>
          <span className="font-medium">{workDays} days</span>
        </div>
        
        {autoDetectWeekends && weekendCount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Weekend days:</span>
            <span className="font-medium flex items-center gap-1">
              {weekendCount} days
              <Badge variant="secondary" className="text-[10px]">Auto-detect ON</Badge>
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">Team members:</span>
          <span className="font-medium">{userCount} people</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Shift type:</span>
          {selectedShift ? (
            <div className="flex flex-col items-end">
              <span className="font-medium">{selectedShift.label}</span>
              {selectedShift.startTime && selectedShift.endTime && (
                <span className="text-xs text-muted-foreground">
                  {selectedShift.startTime}-{selectedShift.endTime}
                </span>
              )}
            </div>
          ) : (
            <span className="font-medium capitalize">{shiftType}</span>
          )}
        </div>
        
        {selectedShift?.dayOfWeek && selectedShift.dayOfWeek.length > 0 && (
          <Alert className="mt-2">
            <AlertDescription className="text-xs">
              ℹ️ This shift is only valid for: <strong>{selectedShift.dayOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</strong>. Alternative shifts will be used automatically for other days.
            </AlertDescription>
          </Alert>
        )}

        <div className="pt-2 mt-2 border-t flex justify-between">
          <span className="font-semibold">Total shifts:</span>
          <span className="font-bold text-primary">{totalShifts}</span>
        </div>
      </div>

      {totalShifts > 0 && (
        <div className="pt-3 mt-3 border-t space-y-2">
          <div className="text-xs text-muted-foreground">
            ✨ Ready to generate {totalShifts} schedule entries
          </div>
          
          {(autoDetectWeekends || autoDetectHolidays) && (
            <div className="flex flex-wrap gap-1 pt-2">
              {autoDetectWeekends && (
                <Badge variant="outline" className="text-[10px]">
                  📅 Weekend detection enabled
                </Badge>
              )}
              {autoDetectHolidays && (
                <Badge variant="outline" className="text-[10px]">
                  🎉 Holiday detection enabled
                </Badge>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Visual day preview */}
      {previewDays.length > 0 && (
        <div className="pt-3 mt-3 border-t">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Date Range Preview:</p>
          <TooltipProvider>
            <div className="grid grid-cols-7 gap-2">
              {previewDays.filter(preview => !excludedDays.includes(preview.date.getDay())).map((preview) => {
                const dayLabel = format(preview.date, 'EEE');
                
                return (
                  <Tooltip key={preview.date.toISOString()}>
                    <TooltipTrigger asChild>
                      <div 
                        className={cn(
                          "p-2 border rounded-md text-center transition-colors relative cursor-help",
                          preview.isWeekend && "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-800",
                          preview.isAlternative && !preview.isWeekend && "bg-yellow-50 border-yellow-300 dark:bg-yellow-950/30 dark:border-yellow-800"
                        )}
                      >
                        <div className="text-xs font-medium text-muted-foreground">{dayLabel}</div>
                        <div className="text-sm font-semibold mt-1">{format(preview.date, 'd')}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {preview.startTime.substring(0, 5)}-{preview.endTime.substring(0, 5)}
                        </div>
                        {preview.isWeekend && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-1 h-4">
                            Weekend
                          </Badge>
                        )}
                        {preview.isAlternative && !preview.isWeekend && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 mt-1 h-4">
                            Alt
                          </Badge>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-1">
                        <div className="font-semibold">{preview.description}</div>
                        <div>{preview.startTime} - {preview.endTime}</div>
                        {preview.isAlternative && <div className="text-muted-foreground">Alternative shift</div>}
                        {preview.isWeekend && <div className="text-muted-foreground">Weekend shift</div>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
          {previewDays.length < dayPreviews.length && (
            <p className="text-xs text-muted-foreground mt-2">
              ... and {dayPreviews.length - previewDays.length} more days
            </p>
          )}
        </div>
      )}
      
      {/* Shift summary */}
      {uniqueShifts.size > 1 && dayPreviews.length > 0 && (
        <div className="pt-3 mt-3 border-t">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Shifts in this schedule:</p>
          <div className="space-y-1">
            {Array.from(uniqueShifts.entries()).map(([shiftId, info]) => (
              <div key={shiftId} className="text-xs flex items-center justify-between">
                <span className="text-muted-foreground">{info.description}:</span>
                <span className="font-medium">
                  {info.times} <span className="text-muted-foreground">({info.count} {info.count === 1 ? 'day' : 'days'})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
