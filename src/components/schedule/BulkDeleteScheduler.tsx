import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TeamPeopleSelector } from "./bulk-scheduler/TeamPeopleSelector";
import { DateRangeQuickPicker } from "./bulk-scheduler/DateRangeQuickPicker";
import type { Database } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ActivityType = Database['public']['Enums']['activity_type'];
type ShiftType = Database['public']['Enums']['shift_type'];

interface BulkDeleteSchedulerProps {
  userId: string | undefined;
  onDeleted?: () => void;
}

export const BulkDeleteScheduler = ({ userId, onDeleted }: BulkDeleteSchedulerProps) => {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [excludedDays, setExcludedDays] = useState<number[]>([]);
  const [skipHolidays, setSkipHolidays] = useState(false);
  
  // Activity type filters
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([
    'work',
    'vacation',
    'hotline_support',
    'other',
    'out_of_office',
    'training',
    'flextime',
    'working_from_home',
  ]);
  
  // Shift type filters
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(['normal', 'early', 'late', 'weekend']);
  
  // Additional options
  const [deleteHotlineAssignments, setDeleteHotlineAssignments] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [preview, setPreview] = useState<{
    scheduleEntryCount: number;
    hotlineAssignmentCount: number;
  }>({ scheduleEntryCount: 0, hotlineAssignmentCount: 0 });
  
  const { toast } = useToast();

  const allActivityTypes: { value: ActivityType; label: string }[] = [
    { value: 'work', label: 'Work shifts' },
    { value: 'vacation', label: 'Vacation' },
    { value: 'hotline_support', label: 'Hotline support' },
    { value: 'out_of_office', label: 'Out of office' },
    { value: 'training', label: 'Training' },
    { value: 'flextime', label: 'Flextime' },
    { value: 'working_from_home', label: 'Working from home' },
    { value: 'other', label: 'Other' },
  ];

  const allShiftTypes: { value: ShiftType; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'early', label: 'Early' },
    { value: 'late', label: 'Late' },
    { value: 'weekend', label: 'Weekend' },
  ];

  const toggleActivityType = (type: ActivityType) => {
    if (activityTypes.includes(type)) {
      setActivityTypes(activityTypes.filter(t => t !== type));
    } else {
      setActivityTypes([...activityTypes, type]);
    }
  };

  const toggleShiftType = (type: ShiftType) => {
    if (shiftTypes.includes(type)) {
      setShiftTypes(shiftTypes.filter(t => t !== type));
    } else {
      setShiftTypes([...shiftTypes, type]);
    }
  };

  // Calculate preview when filters change
  useEffect(() => {
    const calculatePreview = async () => {
      if (!dateRange.start || !dateRange.end || !teamId) {
        setPreview({ scheduleEntryCount: 0, hotlineAssignmentCount: 0 });
        return;
      }

      try {
        // Helper to format date locally (avoid timezone issues)
        const formatLocalDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        // Build date array, respecting excluded days
        let dates: string[] = [];
        const current = new Date(dateRange.start);
        while (current <= dateRange.end) {
          const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
          
          // Only include this date if its day is NOT excluded
          if (!excludedDays.includes(dayOfWeek)) {
            dates.push(formatLocalDate(current));
          }
          current.setDate(current.getDate() + 1);
        }

        // Filter out holidays if skipHolidays is checked
        if (skipHolidays && dates.length > 0) {
          const { data: holidays } = await supabase
            .from('holidays')
            .select('date')
            .in('date', dates);
          
          const holidayDates = new Set(holidays?.map(h => h.date) || []);
          dates = dates.filter(d => !holidayDates.has(d));
        }

        // Get user IDs (from selection or all team members)
        let userIds = selectedUserIds;
        if (userIds.length === 0) {
          const { data } = await supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', teamId);
          userIds = data?.map(m => m.user_id) || [];
        }

        if (userIds.length === 0) {
          setPreview({ scheduleEntryCount: 0, hotlineAssignmentCount: 0 });
          return;
        }

        // Count schedule entries
        let scheduleQuery = supabase
          .from('schedule_entries')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId)
          .in('date', dates)
          .in('user_id', userIds);

        if (activityTypes.length > 0 && activityTypes.length < 8) {
          scheduleQuery = scheduleQuery.in('activity_type', activityTypes);
        }
        if (shiftTypes.length > 0 && shiftTypes.length < 4) {
          scheduleQuery = scheduleQuery.in('shift_type', shiftTypes);
        }

        const { count: scheduleCount } = await scheduleQuery;

        // Count hotline assignments
        let hotlineCount = 0;
        if (deleteHotlineAssignments) {
          const { count } = await supabase
            .from('duty_assignments')
            .select('*', { count: 'exact', head: true })
            .in('date', dates)
            .in('user_id', userIds)
            .eq('team_id', teamId);
          hotlineCount = count || 0;
        }

        setPreview({
          scheduleEntryCount: scheduleCount || 0,
          hotlineAssignmentCount: hotlineCount,
        });
      } catch (error) {
        console.error('Error calculating preview:', error);
      }
    };

    calculatePreview();
  }, [dateRange, teamId, selectedUserIds, activityTypes, shiftTypes, deleteHotlineAssignments, excludedDays, skipHolidays]);

  const isValid = useMemo(() => {
    return (
      dateRange.start &&
      dateRange.end &&
      teamId &&
      (activityTypes.length > 0 || shiftTypes.length > 0)
    );
  }, [dateRange, teamId, activityTypes, shiftTypes]);

  const handleDelete = async () => {
    if (!isValid || !userId) {
      toast({
        title: "Cannot delete",
        description: "Please select date range, team, and at least one filter",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setShowConfirmDialog(false);

    try {
      // Helper to format date locally (avoid timezone issues)
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Build date array, respecting excluded days
      let dates: string[] = [];
      const current = new Date(dateRange.start!);
      while (current <= dateRange.end!) {
        const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Only include this date if its day is NOT excluded
        if (!excludedDays.includes(dayOfWeek)) {
          dates.push(formatLocalDate(current));
        }
        current.setDate(current.getDate() + 1);
      }

      // Filter out holidays if skipHolidays is checked
      if (skipHolidays && dates.length > 0) {
        const { data: holidays } = await supabase
          .from('holidays')
          .select('date')
          .in('date', dates);
        
        const holidayDates = new Set(holidays?.map(h => h.date) || []);
        dates = dates.filter(d => !holidayDates.has(d));
      }

      // Get user IDs
      let userIds = selectedUserIds;
      if (userIds.length === 0) {
        const { data } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', teamId);
        userIds = data?.map(m => m.user_id) || [];
      }

      // Delete schedule entries
      let scheduleQuery = supabase
        .from('schedule_entries')
        .delete()
        .eq('team_id', teamId!)
        .in('date', dates)
        .in('user_id', userIds);

      if (activityTypes.length > 0 && activityTypes.length < 8) {
        scheduleQuery = scheduleQuery.in('activity_type', activityTypes);
      }
      if (shiftTypes.length > 0 && shiftTypes.length < 4) {
        scheduleQuery = scheduleQuery.in('shift_type', shiftTypes);
      }

      const { error: scheduleError } = await scheduleQuery;
      if (scheduleError) throw scheduleError;

      // Delete hotline assignments if selected
      let hotlineDeleted = 0;
      if (deleteHotlineAssignments) {
        const { error: hotlineError, count } = await supabase
          .from('duty_assignments')
          .delete({ count: 'exact' })
          .in('date', dates)
          .in('user_id', userIds)
          .eq('team_id', teamId!);
        
        if (hotlineError) throw hotlineError;
        hotlineDeleted = count || 0;
      }

      toast({
        title: "✅ Deletion complete",
        description: deleteHotlineAssignments
          ? `${preview.scheduleEntryCount} schedule entries + ${hotlineDeleted} hotline assignments deleted`
          : `${preview.scheduleEntryCount} schedule entries deleted`,
      });

      // Reset form
      setDateRange({ start: null, end: null });
      setSelectedUserIds([]);
      setActivityTypes(['work', 'vacation', 'hotline_support', 'other', 'out_of_office', 'training', 'flextime', 'working_from_home']);
      setShiftTypes(['normal', 'early', 'late', 'weekend']);
      setDeleteHotlineAssignments(false);

      onDeleted?.();
    } catch (error: any) {
      console.error('Error deleting entries:', error);
      toast({
        title: "Deletion failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            <TeamPeopleSelector
              teamId={teamId}
              selectedUserIds={selectedUserIds}
              onTeamChange={setTeamId}
              onUserSelectionChange={setSelectedUserIds}
              mode="users"
            />

            <div className="space-y-4">
              <Label className="text-sm font-medium">Activity Types to Delete</Label>
              <div className="space-y-2">
                {allActivityTypes.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`activity-${type.value}`}
                      checked={activityTypes.includes(type.value)}
                      onCheckedChange={() => toggleActivityType(type.value)}
                    />
                    <label
                      htmlFor={`activity-${type.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {type.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <DateRangeQuickPicker
              startDate={dateRange.start}
              endDate={dateRange.end}
              excludedDays={excludedDays}
              skipHolidays={skipHolidays}
              onDateRangeChange={(start, end) => setDateRange({ start, end })}
              onExcludedDaysChange={setExcludedDays}
              onSkipHolidaysChange={setSkipHolidays}
            />

            <div className="space-y-4">
              <Label className="text-sm font-medium">Shift Types to Delete</Label>
              <div className="space-y-2">
                {allShiftTypes.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`shift-${type.value}`}
                      checked={shiftTypes.includes(type.value)}
                      onCheckedChange={() => toggleShiftType(type.value)}
                    />
                    <label
                      htmlFor={`shift-${type.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {type.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-medium">Additional Options</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="deleteHotline"
                  checked={deleteHotlineAssignments}
                  onCheckedChange={(checked) => setDeleteHotlineAssignments(checked === true)}
                />
                <label htmlFor="deleteHotline" className="text-sm cursor-pointer">
                  Also delete hotline assignments
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        {isValid && (
          <Card className="p-4 border-destructive/50 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="space-y-2 flex-1">
                <div className="font-semibold text-destructive">
                  Preview: Will delete {preview.scheduleEntryCount + preview.hotlineAssignmentCount} entries
                </div>
                <div className="text-sm space-y-1">
                  <div>• {preview.scheduleEntryCount} schedule entries</div>
                  {deleteHotlineAssignments && (
                    <div>• {preview.hotlineAssignmentCount} hotline assignments</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  ⚠️ This action cannot be undone
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Delete button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="destructive"
            size="lg"
            onClick={() => setShowConfirmDialog(true)}
            disabled={!isValid || loading || preview.scheduleEntryCount === 0}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete Permanently
          </Button>
        </div>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>
                This will permanently delete <strong>{preview.scheduleEntryCount} schedule entries</strong>
                {deleteHotlineAssignments && (
                  <> and <strong>{preview.hotlineAssignmentCount} hotline assignments</strong></>
                )}.
              </div>
              <div className="text-destructive font-medium">
                This action cannot be undone.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
