import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPatternSummary, applyRotationPattern } from '@/lib/rotationPatternUtils';

interface ApplyTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: any;
  selectedUsers: Array<{ user_id: string; name: string }>;
  selectedDates: string[];
  teamId: string;
  onApply: (entries: any[]) => Promise<void>;
}

export const ApplyTemplateDialog = ({
  open,
  onOpenChange,
  template,
  selectedUsers,
  selectedDates,
  teamId,
  onApply,
}: ApplyTemplateDialogProps) => {
  const [applying, setApplying] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date(selectedDates[0]));
  const [respectExisting, setRespectExisting] = useState(true);
  const [skipHolidays, setSkipHolidays] = useState(true);
  const [skipWeekends, setSkipWeekends] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    try {
      const allEntries: any[] = [];

      selectedUsers.forEach((user) => {
        const entries = applyRotationPattern(
          template.pattern_config,
          user.user_id,
          teamId,
          selectedDates,
          {
            skipWeekends,
            skipHolidays,
            holidays: [], // TODO: Fetch actual holidays
          }
        );
        allEntries.push(...entries);
      });

      await onApply(allEntries);
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  };

  const totalEntries = selectedUsers.length * selectedDates.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apply Template: {template?.template_name}</DialogTitle>
          <DialogDescription>
            Configure how the rotation pattern should be applied
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selection Summary */}
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="text-sm font-medium mb-2">Selection Summary</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                Selected: <span className="font-medium">{selectedUsers.length} team members</span>,{' '}
                <span className="font-medium">{selectedDates.length} days</span>
              </div>
              <div>
                Date Range: <span className="font-medium">{selectedDates[0]}</span> to{' '}
                <span className="font-medium">{selectedDates[selectedDates.length - 1]}</span>
              </div>
              <div>
                Pattern: <span className="font-medium">{getPatternSummary(template)}</span>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="respect"
                checked={respectExisting}
                onCheckedChange={(checked) => setRespectExisting(checked as boolean)}
              />
              <Label htmlFor="respect" className="cursor-pointer">
                Respect existing schedule entries (don't overwrite)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="holidays"
                checked={skipHolidays}
                onCheckedChange={(checked) => setSkipHolidays(checked as boolean)}
              />
              <Label htmlFor="holidays" className="cursor-pointer">
                Skip holidays (auto day off)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="weekends"
                checked={skipWeekends}
                onCheckedChange={(checked) => setSkipWeekends(checked as boolean)}
              />
              <Label htmlFor="weekends" className="cursor-pointer">
                Skip weekends
              </Label>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
            <div className="text-sm font-medium">Preview Result</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Total entries to create: <span className="font-medium">{totalEntries}</span></div>
              <div className="text-xs">
                {selectedUsers.slice(0, 3).map((user) => user.name).join(', ')}
                {selectedUsers.length > 3 && ` ...and ${selectedUsers.length - 3} more`}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={applying}>
            {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply Pattern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
