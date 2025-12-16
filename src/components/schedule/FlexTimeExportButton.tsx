import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { DailyTimeEntry, MonthlyFlexSummary } from "@/hooks/useTimeEntries";
import { ENTRY_TYPE_LABELS, formatFlexHours } from "@/lib/flexTimeUtils";

interface FlexTimeExportButtonProps {
  entries: DailyTimeEntry[];
  monthlySummary: MonthlyFlexSummary | null;
  previousBalance: number;
  currentMonthDelta: number;
  currentBalance: number;
  carryoverLimit: number;
  monthDate: Date;
  userName: string;
}

export function FlexTimeExportButton({
  entries,
  monthlySummary,
  previousBalance,
  currentMonthDelta,
  currentBalance,
  carryoverLimit,
  monthDate,
  userName,
}: FlexTimeExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Daily Time Entries
      const entriesData = entries.map((entry) => {
        const date = parseISO(entry.entry_date);
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
          "FlexTime Delta": formatFlexHours(entry.flextime_delta || 0),
          "Comment": entry.comment || "",
        };
      });

      // Add empty row message if no entries
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
          "FlexTime Delta": "",
          "Comment": "",
        } as any);
      }

      const entriesSheet = XLSX.utils.json_to_sheet(entriesData);
      
      // Set column widths
      entriesSheet["!cols"] = [
        { wch: 12 }, // Date
        { wch: 12 }, // Day
        { wch: 15 }, // Entry Type
        { wch: 10 }, // Start Time
        { wch: 10 }, // End Time
        { wch: 10 }, // Break
        { wch: 12 }, // Gross Hours
        { wch: 12 }, // Actual Hours
        { wch: 12 }, // Target Hours
        { wch: 14 }, // FlexTime Delta
        { wch: 30 }, // Comment
      ];

      XLSX.utils.book_append_sheet(workbook, entriesSheet, "Time Entries");

      // Sheet 2: Monthly Summary
      const monthName = format(monthDate, "MMMM yyyy", { locale: de });
      const summaryData = [
        { "Metric": "Month", "Value": monthName },
        { "Metric": "Starting Balance", "Value": formatFlexHours(previousBalance) },
        { "Metric": "Month Delta", "Value": formatFlexHours(currentMonthDelta) },
        { "Metric": "Ending Balance", "Value": formatFlexHours(currentBalance) },
        { "Metric": "", "Value": "" },
        { "Metric": "Carryover Limit", "Value": formatFlexHours(carryoverLimit) },
        { 
          "Metric": "Status", 
          "Value": Math.abs(currentBalance) <= carryoverLimit 
            ? "✓ Within Limit" 
            : "⚠ Exceeds Limit" 
        },
      ];

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      summarySheet["!cols"] = [
        { wch: 20 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Monthly Summary");

      // Sheet 3: Employee Info (for HR)
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
      infoSheet["!cols"] = [
        { wch: 25 },
        { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(workbook, infoSheet, "Employee Info");

      // Generate filename
      const fileName = `FlexTime_${userName.replace(/\s+/g, "_")}_${format(monthDate, "yyyy-MM")}.xlsx`;

      // Download
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error("Error exporting FlexTime data:", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className="gap-1.5"
    >
      <Download className="w-4 h-4" />
      {exporting ? "Exporting..." : "Export"}
    </Button>
  );
}
