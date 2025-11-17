import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWeekend, getDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { TimeBlockDisplay } from "./TimeBlockDisplay";

type ViewMode = "single" | "multi";
type DateRange = "1M" | "3M" | "6M" | "1Y";

interface ScheduleEntry {
  id: string;
  date: string;
  shift_type: string | null;
  activity_type: string;
  availability_status: string;
  notes: string | null;
}

interface MonthStats {
  totalShifts: number;
  earlyShifts: number;
  lateShifts: number;
  normalShifts: number;
  weekendShifts: number;
  vacationDays: number;
  otherDays: number;
}

const getShiftColor = (shiftType: string | null, activityType: string): string => {
  if (activityType === 'vacation') {
    return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300';
  }
  if (activityType === 'out_of_office') {
    return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300';
  }
  if (activityType === 'other') {
    return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-950 dark:text-gray-300';
  }
  
  switch (shiftType) {
    case 'early':
      return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300';
    case 'late':
      return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300';
    case 'normal':
      return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300';
    case 'weekend':
      return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getShiftLabel = (shiftType: string | null, activityType: string): string => {
  if (activityType === 'vacation') return 'Vacation';
  if (activityType === 'out_of_office') return 'OOO';
  if (activityType === 'other') return 'Other';
  
  switch (shiftType) {
    case 'early': return 'Early';
    case 'late': return 'Late';
    case 'normal': return 'Normal';
    case 'weekend': return 'Weekend';
    default: return 'Work';
  }
};

export function PersonalMonthlyCalendar() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [dateRange, setDateRange] = useState<DateRange>("1M");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchScheduleData();
    }
  }, [user?.id, currentMonth, dateRange]);

  const fetchScheduleData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const monthsToFetch = getMonthsCount(dateRange);
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(addMonths(currentMonth, monthsToFetch - 1));

      const { data, error } = await supabase
        .from("schedule_entries")
        .select("id, date, shift_type, activity_type, availability_status, notes")
        .eq("user_id", user.id)
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"))
        .order("date", { ascending: true });

      if (error) throw error;
      setScheduleEntries(data || []);
    } catch (error) {
      console.error("Error fetching schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMonthsCount = (range: DateRange): number => {
    switch (range) {
      case "1M": return 1;
      case "3M": return 3;
      case "6M": return 6;
      case "1Y": return 12;
    }
  };

  const calculateMonthStats = (monthDate: Date): MonthStats => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const monthEntries = scheduleEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= monthStart && entryDate <= monthEnd;
    });

    return {
      totalShifts: monthEntries.filter(e => e.activity_type === 'work').length,
      earlyShifts: monthEntries.filter(e => e.shift_type === 'early').length,
      lateShifts: monthEntries.filter(e => e.shift_type === 'late').length,
      normalShifts: monthEntries.filter(e => e.shift_type === 'normal').length,
      weekendShifts: monthEntries.filter(e => e.shift_type === 'weekend').length,
      vacationDays: monthEntries.filter(e => e.activity_type === 'vacation').length,
      otherDays: monthEntries.filter(e => e.activity_type === 'other' || e.activity_type === 'out_of_office').length,
    };
  };

  const renderMonthCalendar = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const stats = calculateMonthStats(monthDate);

    // Get first day of month (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = getDay(monthStart);
    // Create empty cells for alignment
    const emptyCells = Array.from({ length: firstDayOfWeek }, (_, i) => i);

    const handleCellClick = (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const entry = scheduleEntries.find(e => e.date.split('T')[0] === dateStr);
      if (entry) {
        setSelectedEntry(entry);
        setDetailsOpen(true);
      }
    };

    return (
      <div key={format(monthDate, "yyyy-MM")} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{format(monthDate, "MMMM yyyy")}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="w-4 h-4" />
            <span>{stats.totalShifts} shifts</span>
          </div>
        </div>

        {/* Statistics Panel */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.normalShifts}</div>
                <div className="text-xs text-muted-foreground">Normal</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.earlyShifts}</div>
                <div className="text-xs text-muted-foreground">Early</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.lateShifts}</div>
                <div className="text-xs text-muted-foreground">Late</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.weekendShifts}</div>
                <div className="text-xs text-muted-foreground">Weekend</div>
              </div>
            </div>
            {(stats.vacationDays > 0 || stats.otherDays > 0) && (
              <div className="mt-3 pt-3 border-t flex justify-center gap-6 text-sm">
                {stats.vacationDays > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {stats.vacationDays} vacation day{stats.vacationDays > 1 ? 's' : ''}
                  </span>
                )}
                {stats.otherDays > 0 && (
                  <span className="text-gray-600 dark:text-gray-400">
                    {stats.otherDays} other day{stats.otherDays > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-muted-foreground p-2">
              {day}
            </div>
          ))}

          {/* Empty cells for alignment */}
          {emptyCells.map(i => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Calendar days */}
          {allDays.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEntries = scheduleEntries.filter(e => e.date.split('T')[0] === dateStr);
            const isWeekendDay = isWeekend(day);

            return (
              <button
                key={dateStr}
                onClick={() => dayEntries.length > 0 && handleCellClick(day)}
                className={cn(
                  "aspect-square p-1 rounded-lg border transition-all",
                  "hover:border-primary hover:shadow-sm",
                  isWeekendDay && "bg-muted/30",
                  dayEntries.length > 0 && "cursor-pointer",
                  dayEntries.length === 0 && "cursor-default opacity-60"
                )}
              >
                <div className="flex flex-col items-center justify-center h-full gap-1">
                  <span className={cn(
                    "text-xs font-medium",
                    isWeekendDay && "text-muted-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  {dayEntries.map((entry, idx) => (
                    <Badge
                      key={entry.id}
                      variant="outline"
                      className={cn(
                        "text-[8px] px-1 py-0 h-4 leading-none",
                        getShiftColor(entry.shift_type, entry.activity_type)
                      )}
                    >
                      {getShiftLabel(entry.shift_type, entry.activity_type).substring(0, 3)}
                    </Badge>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  const monthsToDisplay = Array.from({ length: getMonthsCount(dateRange) }, (_, i) => 
    addMonths(currentMonth, i)
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-primary" />
              <CardTitle>My Schedule</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex rounded-lg border bg-muted p-1">
                <Button
                  variant={viewMode === "single" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("single")}
                >
                  Single
                </Button>
                <Button
                  variant={viewMode === "multi" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("multi")}
                >
                  Multi
                </Button>
              </div>

              {/* Date Range Selector */}
              <div className="flex rounded-lg border bg-muted p-1">
                {(['1M', '3M', '6M', '1Y'] as DateRange[]).map(range => (
                  <Button
                    key={range}
                    variant={dateRange === range ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setDateRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>

              {/* Month Navigation */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Display */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Loading your schedule...
          </CardContent>
        </Card>
      ) : viewMode === "single" ? (
        <Card>
          <CardContent className="p-6">
            {renderMonthCalendar(currentMonth)}
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={[format(currentMonth, "yyyy-MM")]} className="space-y-4">
          {monthsToDisplay.map(monthDate => (
            <AccordionItem key={format(monthDate, "yyyy-MM")} value={format(monthDate, "yyyy-MM")} className="border rounded-lg">
              <AccordionTrigger className="px-6 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-semibold">{format(monthDate, "MMMM yyyy")}</span>
                  <Badge variant="outline" className="text-xs">
                    {calculateMonthStats(monthDate).totalShifts} shifts
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                {renderMonthCalendar(monthDate)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Shift Details</DialogTitle>
            <DialogDescription>
              {selectedEntry && format(new Date(selectedEntry.date), "EEEE, MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={getShiftColor(selectedEntry.shift_type, selectedEntry.activity_type)}>
                  {getShiftLabel(selectedEntry.shift_type, selectedEntry.activity_type)}
                </Badge>
                <Badge variant="outline">
                  {selectedEntry.availability_status}
                </Badge>
              </div>
              <TimeBlockDisplay
                entry={{
                  id: selectedEntry.id,
                  user_id: user?.id || '',
                  activity_type: selectedEntry.activity_type,
                  shift_type: selectedEntry.shift_type || 'normal',
                  notes: selectedEntry.notes || undefined
                }}
                showNotes={true}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
