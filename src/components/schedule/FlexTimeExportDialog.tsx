import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import * as XLSX from "xlsx";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { ENTRY_TYPE_LABELS, formatFlexHours } from "@/lib/flexTimeUtils";
import type { DailyTimeEntry, MonthlyFlexSummary } from "@/hooks/useTimeEntries";

interface FlexTimeExportDialogProps {
  currentMonthDate: Date;
  userName: string;
  carryoverLimit: number;
}

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function FlexTimeExportDialog({
  currentMonthDate,
  userName,
  carryoverLimit,
}: FlexTimeExportDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonthDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(currentMonthDate.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<{
    entries: DailyTimeEntry[];
    previousBalance: number;
    monthDelta: number;
    currentBalance: number;
  } | null>(null);

  // Generate year options (current year and 2 previous)
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => ({
    value: String(y),
    label: String(y),
  }));

  // Fetch preview data when month/year changes
  useEffect(() => {
    if (!open || !user?.id) return;
    
    const fetchPreviewData = async () => {
      setLoading(true);
      try {
        const month = parseInt(selectedMonth);
        const year = parseInt(selectedYear);
        const monthDate = new Date(year, month - 1, 1);
        const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

        // Fetch entries
        const { data: entriesData } = await supabase
          .from('daily_time_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('entry_date', startDate)
          .lte('entry_date', endDate)
          .order('entry_date', { ascending: true });

        // Fetch previous month balance
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        
        const { data: prevSummary } = await supabase
          .from('monthly_flextime_summary')
          .select('ending_balance')
          .eq('user_id', user.id)
          .eq('year', prevYear)
          .eq('month', prevMonth)
          .maybeSingle();

        const entries = (entriesData || []) as DailyTimeEntry[];
        const previousBalance = prevSummary?.ending_balance || 0;
        const monthDelta = entries.reduce((sum, e) => sum + (e.flextime_delta || 0), 0);
        const currentBalance = previousBalance + monthDelta;

        setPreview({ entries, previousBalance, monthDelta, currentBalance });
      } catch (error) {
        console.error('Error fetching preview:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewData();
  }, [open, selectedMonth, selectedYear, user?.id]);

  const handleExport = async () => {
    if (!preview) return;
    
    setExporting(true);
    try {
      const month = parseInt(selectedMonth);
      const year = parseInt(selectedYear);
      const monthDate = new Date(year, month - 1, 1);
      const { entries, previousBalance, monthDelta, currentBalance } = preview;

      const workbook = XLSX.utils.book_new();

      // Sheet 1: Daily Time Entries with FZA column
      const entriesData = entries.map((entry) => {
        const date = parseISO(entry.entry_date);
        const isFzaEntry = entry.entry_type === 'fza_withdrawal';
        return {
          "Date": format(date, "dd.MM.yyyy"),
          "Day": format(date, "EEEE", { locale: de }),
          "Entry Type": ENTRY_TYPE_LABELS[entry.entry_type as keyof typeof ENTRY_TYPE_LABELS] || entry.entry_type,
          "Start Time": entry.work_start_time || "-",
          "End Time": entry.work_end_time || "-",
          "Break (min)": entry.break_duration_minutes || 0,
          "Gross Hours": entry.work_start_time && entry.work_end_time 
            ? ((entry.actual_hours_worked || 0) + (entry.break_duration_minutes || 0) / 60).toFixed(2)
            : "-",
          "Actual Hours": entry.actual_hours_worked?.toFixed(2) || "-",
          "Target Hours": entry.target_hours?.toFixed(2) || "-",
          "FLEX": isFzaEntry ? "0.00" : formatFlexHours(entry.flextime_delta || 0),
          "FZA": isFzaEntry ? `-${(entry.fza_hours || 0).toFixed(2)}` : "0.00",
          "Comment": entry.comment || "",
        };
      });

      if (entriesData.length === 0) {
        entriesData.push({
          "Date": "No entries for this month",
          "Day": "",
          "Entry Type": "",
          "Start Time": "",
          "End Time": "",
          "Break (min)": "",
          "Gross Hours": "",
          "Actual Hours": "",
          "Target Hours": "",
          "FLEX": "",
          "FZA": "",
          "Comment": "",
        } as any);
      }

      const entriesSheet = XLSX.utils.json_to_sheet(entriesData);
      entriesSheet["!cols"] = [
        { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(workbook, entriesSheet, "Time Entries");

      // Sheet 2: Monthly Summary
      const monthName = format(monthDate, "MMMM yyyy", { locale: de });
      const fzaTotalHours = entries
        .filter(e => e.entry_type === 'fza_withdrawal')
        .reduce((sum, e) => sum + (e.fza_hours || 0), 0);
      const pureFlexDelta = entries
        .filter(e => e.entry_type !== 'fza_withdrawal')
        .reduce((sum, e) => sum + (e.flextime_delta || 0), 0);

      const summaryData = [
        { "Metric": "Month", "Value": monthName },
        { "Metric": "Starting Balance", "Value": formatFlexHours(previousBalance) },
        { "Metric": "", "Value": "" },
        { "Metric": "FLEX Earned", "Value": formatFlexHours(pureFlexDelta) },
        { "Metric": "FZA Taken", "Value": fzaTotalHours > 0 ? `-${fzaTotalHours.toFixed(2)}h` : "0.00h" },
        { "Metric": "Net Month Delta", "Value": formatFlexHours(monthDelta) },
        { "Metric": "", "Value": "" },
        { "Metric": "Ending Balance", "Value": formatFlexHours(currentBalance) },
        { "Metric": "", "Value": "" },
        { "Metric": "Carryover Limit", "Value": formatFlexHours(carryoverLimit) },
        { 
          "Metric": "Status", 
          "Value": Math.abs(currentBalance) <= carryoverLimit ? "✓ Within Limit" : "⚠ Exceeds Limit" 
        },
      ];

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Monthly Summary");

      // Sheet 3: Employee Info
      const infoData = [
        { "Field": "Employee Name", "Value": userName },
        { "Field": "Report Period", "Value": monthName },
        { "Field": "Generated On", "Value": format(new Date(), "dd.MM.yyyy HH:mm") },
        { "Field": "", "Value": "" },
        { "Field": "Total Entries", "Value": entries.length.toString() },
        { "Field": "Final FlexTime Balance", "Value": formatFlexHours(currentBalance) },
        { "Field": "Carryover Limit", "Value": formatFlexHours(carryoverLimit) },
      ];

      const infoSheet = XLSX.utils.json_to_sheet(infoData);
      infoSheet["!cols"] = [{ wch: 25 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(workbook, infoSheet, "Employee Info");

      const fileName = `FlexTime_${userName.replace(/\s+/g, "_")}_${format(monthDate, "yyyy-MM")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      setOpen(false);
    } catch (error) {
      console.error("Error exporting FlexTime data:", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Export FlexTime Data
          </DialogTitle>
          <DialogDescription>
            Select the month to export your FlexTime data to Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y.value} value={y.value}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground animate-pulse">
              Loading preview...
            </div>
          ) : preview && (
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <div className="text-sm font-medium">Preview</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Entries:</span>
                <span>{preview.entries.length}</span>
                <span className="text-muted-foreground">Starting Balance:</span>
                <span>{formatFlexHours(preview.previousBalance)}</span>
                <span className="text-muted-foreground">Month Delta:</span>
                <span className={preview.monthDelta >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatFlexHours(preview.monthDelta)}
                </span>
                <span className="text-muted-foreground">Ending Balance:</span>
                <span className={preview.currentBalance >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatFlexHours(preview.currentBalance)}
                </span>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Export includes:</p>
            <ul className="list-disc list-inside ml-2">
              <li>Daily time entries with FLEX &amp; FZA</li>
              <li>Monthly summary</li>
              <li>Employee info for HR</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading || !preview}>
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Exporting..." : "Download Excel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
