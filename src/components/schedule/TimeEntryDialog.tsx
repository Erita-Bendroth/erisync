import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeSelect } from "@/components/ui/time-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, AlertTriangle, Trash2, Save } from "lucide-react";
import {
  calculateFlexTime,
  formatFlexHours,
  formatDecimalHours,
  validateBreakRequirements,
  validateDailyLimit,
  getDefaultStartTime,
  getDefaultEndTime,
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_CONFIG,
  type EntryType,
} from "@/lib/flexTimeUtils";
import type { DailyTimeEntry, TimeEntryInput } from "@/hooks/useTimeEntries";
import { cn } from "@/lib/utils";

interface TimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  existingEntry?: DailyTimeEntry;
  onSave: (input: TimeEntryInput) => Promise<boolean>;
  onDelete?: (entryDate: string) => Promise<boolean>;
}

export function TimeEntryDialog({
  open,
  onOpenChange,
  date,
  existingEntry,
  onSave,
  onDelete,
}: TimeEntryDialogProps) {
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [breakMinutes, setBreakMinutes] = useState<number>(30);
  const [entryType, setEntryType] = useState<EntryType>("work");
  const [comment, setComment] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset form when dialog opens or date changes
  useEffect(() => {
    if (open) {
      if (existingEntry) {
        setStartTime(existingEntry.work_start_time || "");
        setEndTime(existingEntry.work_end_time || "");
        setBreakMinutes(existingEntry.break_duration_minutes || 30);
        setEntryType((existingEntry.entry_type as EntryType) || "work");
        setComment(existingEntry.comment || "");
      } else {
        // Default values for new entry
        const defaultType: EntryType = "work";
        setEntryType(defaultType);
        setStartTime(getDefaultStartTime(defaultType));
        setEndTime(getDefaultEndTime(date, defaultType));
        setBreakMinutes(30);
        setComment("");
      }
    }
  }, [open, date, existingEntry]);

  // Update times when entry type changes
  const handleEntryTypeChange = (newType: EntryType) => {
    setEntryType(newType);
    const config = ENTRY_TYPE_CONFIG[newType];
    
    if (!config.requiresTimeEntry) {
      setStartTime("");
      setEndTime("");
      setBreakMinutes(0);
    } else if (!startTime && !endTime) {
      setStartTime(getDefaultStartTime(newType));
      setEndTime(getDefaultEndTime(date, newType));
      setBreakMinutes(30);
    }
  };

  // Calculate flextime
  const calculation = calculateFlexTime(date, {
    workStartTime: startTime || null,
    workEndTime: endTime || null,
    breakDurationMinutes: breakMinutes,
    entryType,
  });

  // Validations
  const breakValidation = validateBreakRequirements(calculation.actualHours, breakMinutes);
  const dailyLimitValidation = validateDailyLimit(calculation.actualHours);
  const entryConfig = ENTRY_TYPE_CONFIG[entryType];
  const requiresTime = entryConfig.requiresTimeEntry;
  const hasValidTimes = !requiresTime || (startTime && endTime);

  const handleSave = async () => {
    if (!hasValidTimes) return;
    
    setSaving(true);
    const success = await onSave({
      entry_date: format(date, "yyyy-MM-dd"),
      work_start_time: startTime || null,
      work_end_time: endTime || null,
      break_duration_minutes: breakMinutes,
      entry_type: entryType,
      comment: comment || null,
    });
    setSaving(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !existingEntry) return;
    
    setDeleting(true);
    const success = await onDelete(format(date, "yyyy-MM-dd"));
    setDeleting(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  const dayName = format(date, "EEEE");
  const isFriday = date.getDay() === 5;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Time Entry
          </DialogTitle>
          <DialogDescription>
            {format(date, "EEEE, MMMM d, yyyy")}
            {isWeekend && (
              <Badge variant="secondary" className="ml-2">Weekend</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entry Type */}
          <div className="space-y-2">
            <Label>Entry Type</Label>
            <Select value={entryType} onValueChange={(v) => handleEntryTypeChange(v as EntryType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Entry Fields - only show when required */}
          {requiresTime && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <TimeSelect
                    value={startTime}
                    onValueChange={setStartTime}
                    placeholder="Select start time"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <TimeSelect
                    value={endTime}
                    onValueChange={setEndTime}
                    placeholder="Select end time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="break">Break (minutes)</Label>
                <Input
                  id="break"
                  type="number"
                  min="0"
                  step="5"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
                />
              </div>
            </>
          )}

          {/* Calculation Summary */}
          {requiresTime && startTime && endTime && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="text-muted-foreground">Target Hours:</div>
                <div className="font-medium">
                  {formatDecimalHours(calculation.targetHours)}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({isFriday ? "Friday" : dayName})
                  </span>
                </div>
                
                <div className="text-muted-foreground">Gross Hours:</div>
                <div className="font-medium">{formatDecimalHours(calculation.grossHours)}</div>
                
                <div className="text-muted-foreground">Break:</div>
                <div className="font-medium">{breakMinutes} min</div>
                
                <div className="text-muted-foreground">Actual Worked:</div>
                <div className="font-medium">{formatDecimalHours(calculation.actualHours)}</div>
                
                <div className="text-muted-foreground font-medium">FlexTime Delta:</div>
                <div className={cn(
                  "font-bold text-base",
                  calculation.flexDelta > 0 && "text-green-600 dark:text-green-400",
                  calculation.flexDelta < 0 && "text-red-600 dark:text-red-400",
                  calculation.flexDelta === 0 && "text-muted-foreground"
                )}>
                  {formatFlexHours(calculation.flexDelta)}
                </div>
              </div>
            </div>
          )}

          {/* Validation Warnings */}
          {requiresTime && !breakValidation.valid && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{breakValidation.message}</AlertDescription>
            </Alert>
          )}
          
          {requiresTime && !dailyLimitValidation.valid && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{dailyLimitValidation.message}</AlertDescription>
            </Alert>
          )}

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comment (optional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add notes about this day..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          {existingEntry && onDelete ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !hasValidTimes}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
