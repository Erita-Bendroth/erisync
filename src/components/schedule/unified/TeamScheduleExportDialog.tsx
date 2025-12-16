import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addMonths, addYears } from 'date-fns';
import * as XLSX from 'xlsx';

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface TeamSection {
  teamId: string;
  teamName: string;
  members: TeamMember[];
  color: string;
}

interface TeamScheduleExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamIds: string[];
  teamSections: TeamSection[];
  defaultStartDate: Date;
}

type ExportRange = 'week' | 'month' | '3months' | '6months' | 'year';

const RANGE_OPTIONS: { value: ExportRange; label: string; description: string }[] = [
  { value: 'week', label: 'Current Week', description: '7 days' },
  { value: 'month', label: 'Current Month', description: '~30 days' },
  { value: '3months', label: '3 Months', description: '~90 days' },
  { value: '6months', label: '6 Months', description: '~180 days' },
  { value: 'year', label: '1 Year', description: '365 days' },
];

export const TeamScheduleExportDialog: React.FC<TeamScheduleExportDialogProps> = ({
  open,
  onOpenChange,
  teamIds,
  teamSections,
  defaultStartDate,
}) => {
  const { toast } = useToast();
  const [selectedRange, setSelectedRange] = useState<ExportRange>('year');
  const [loading, setLoading] = useState(false);

  const getDateRange = (range: ExportRange): { startDate: Date; endDate: Date } => {
    const startDate = defaultStartDate;
    let endDate: Date;

    switch (range) {
      case 'week':
        endDate = addDays(startDate, 6);
        break;
      case 'month':
        endDate = addMonths(startDate, 1);
        break;
      case '3months':
        endDate = addMonths(startDate, 3);
        break;
      case '6months':
        endDate = addMonths(startDate, 6);
        break;
      case 'year':
        endDate = addYears(startDate, 1);
        break;
      default:
        endDate = addDays(startDate, 6);
    }

    return { startDate, endDate };
  };

  const generateDates = (startDate: Date, endDate: Date): string[] => {
    const dates: string[] = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
    return dates;
  };

  const handleExport = async () => {
    if (teamIds.length === 0) {
      toast({
        title: 'No teams selected',
        description: 'Please select at least one team to export.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { startDate, endDate } = getDateRange(selectedRange);
      const dates = generateDates(startDate, endDate);

      // Fetch all schedule entries for the date range and teams
      const { data: entries, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .in('team_id', teamIds)
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1]);

      if (error) throw error;

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Track used sheet names to avoid duplicates
      const usedSheetNames = new Set<string>();

      const getUniqueSheetName = (baseName: string, teamId: string): string => {
        // Excel sheet names are limited to 31 characters
        // Remove invalid characters: : \ / ? * [ ]
        const sanitizedBase = baseName.replace(/[:\\/?\*\[\]]/g, '-').trim();
        
        // Add short team ID suffix for distinguishability (first 4 chars)
        const shortId = teamId.substring(0, 4).toUpperCase();
        const suffix = ` [${shortId}]`;
        
        // Truncate base name to leave room for suffix (31 - 7 = 24 chars)
        const maxBaseLength = 31 - suffix.length;
        let sheetName = sanitizedBase.substring(0, maxBaseLength).trim() + suffix;
        
        if (!usedSheetNames.has(sheetName)) {
          usedSheetNames.add(sheetName);
          return sheetName;
        }
        
        // If still duplicate (rare), add a number
        let counter = 2;
        let uniqueName: string;
        do {
          const numSuffix = ` (${counter})`;
          const maxLen = 31 - suffix.length - numSuffix.length;
          uniqueName = sanitizedBase.substring(0, maxLen).trim() + numSuffix + suffix;
          counter++;
        } while (usedSheetNames.has(uniqueName));
        
        usedSheetNames.add(uniqueName);
        return uniqueName;
      };

      // Create a sheet for each team
      teamSections.forEach((section) => {
        // Header row with dates
        const headerRow = ['Team Member', ...dates.map(d => format(new Date(d), 'EEE MMM d'))];
        const data: string[][] = [headerRow];

        // Add rows for each team member
        section.members.forEach((member) => {
          const row = [
            `${member.first_name} ${member.last_name}`,
            ...dates.map((date) => {
              const entry = entries?.find(
                (e) => e.user_id === member.user_id && e.date === date && e.team_id === section.teamId
              );
              if (!entry) return '';
              
              // Format: shift_type / activity_type
              const parts: string[] = [];
              if (entry.shift_type) parts.push(entry.shift_type);
              if (entry.activity_type && entry.activity_type !== 'work') {
                parts.push(entry.activity_type);
              }
              return parts.join('/') || '';
            }),
          ];
          data.push(row);
        });

        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(data);

        // Set column widths
        const colWidths = [{ wch: 20 }, ...dates.map(() => ({ wch: 12 }))];
        worksheet['!cols'] = colWidths;

        // Add sheet to workbook with unique name including team ID
        const sheetName = getUniqueSheetName(section.teamName, section.teamId);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      // Generate filename with date range
      const filename = `schedule-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(workbook, filename);

      toast({
        title: 'Export Complete',
        description: `Exported ${dates.length} days of schedule data for ${teamSections.length} team(s).`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'An error occurred while exporting the schedule.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const { startDate, endDate } = getDateRange(selectedRange);
  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Schedule</DialogTitle>
          <DialogDescription>
            Export schedule data to Excel. Select the date range to export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Export Range</Label>
            <RadioGroup
              value={selectedRange}
              onValueChange={(v) => setSelectedRange(v as ExportRange)}
              className="space-y-2"
            >
              {RANGE_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedRange(option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                    <span className="font-medium">{option.label}</span>
                    <span className="ml-2 text-muted-foreground text-sm">({option.description})</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="font-medium">Export Summary</div>
            <div className="text-muted-foreground mt-1 space-y-1">
              <div>Date Range: {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}</div>
              <div>Days: {dayCount}</div>
              <div>Teams: {teamSections.length}</div>
              <div>Team Members: {teamSections.reduce((sum, t) => sum + t.members.length, 0)}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading || teamIds.length === 0}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
