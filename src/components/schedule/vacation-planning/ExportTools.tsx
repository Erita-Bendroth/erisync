import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
import { VacationRequest, DayCapacity } from '@/hooks/useVacationPlanning';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface ExportToolsProps {
  vacationRequests: VacationRequest[];
  capacityData: DayCapacity[];
  teams: Array<{ id: string; name: string }>;
  dateRange: { start: Date; end: Date };
}

export const ExportTools = ({ vacationRequests, capacityData, teams, dateRange }: ExportToolsProps) => {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const exportToExcel = () => {
    setExporting(true);
    try {
      // Vacation Requests Sheet
      const requestsData = vacationRequests.map(req => ({
        'Employee': `${req.profiles?.first_name} ${req.profiles?.last_name}`,
        'Team': req.teams?.name,
        'Date': format(parseISO(req.requested_date), 'MMM d, yyyy'),
        'Type': req.is_full_day ? 'Full Day' : 'Partial',
        'Status': req.status,
        'Approved By': req.approver_id ? 'Yes' : 'Pending',
        'Notes': req.notes || ''
      }));

      // Capacity Data Sheet
      const capacityDataFormatted = capacityData.map(cd => ({
        'Date': format(parseISO(cd.date), 'MMM d, yyyy'),
        'Team': cd.team_name,
        'Total Members': cd.total_members,
        'On Vacation': cd.on_vacation,
        'Available': cd.available,
        'Required': cd.required_capacity,
        'Coverage %': cd.coverage_percentage,
        'Risk Level': cd.risk_level
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(requestsData);
      const ws2 = XLSX.utils.json_to_sheet(capacityDataFormatted);

      XLSX.utils.book_append_sheet(wb, ws1, 'Vacation Requests');
      XLSX.utils.book_append_sheet(wb, ws2, 'Capacity Analysis');

      // Generate filename
      const filename = `Vacation-Plan-${format(dateRange.start, 'yyyy-MM-dd')}-to-${format(dateRange.end, 'yyyy-MM-dd')}.xlsx`;
      
      XLSX.writeFile(wb, filename);

      toast({
        title: "Export Successful",
        description: "Vacation schedule exported to Excel"
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export to Excel",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      let yPosition = 20;

      // Title
      doc.setFontSize(18);
      doc.text('Vacation & Workforce Planning Report', 20, yPosition);
      yPosition += 10;

      // Date Range
      doc.setFontSize(12);
      doc.text(
        `Period: ${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`,
        20,
        yPosition
      );
      yPosition += 15;

      // Summary Statistics
      doc.setFontSize(14);
      doc.text('Summary', 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      const pendingCount = vacationRequests.filter(vr => vr.status === 'pending').length;
      const approvedCount = vacationRequests.filter(vr => vr.status === 'approved').length;
      const criticalDays = capacityData.filter(cd => cd.risk_level === 'critical').length;
      const warningDays = capacityData.filter(cd => cd.risk_level === 'warning').length;

      doc.text(`Total Vacation Requests: ${vacationRequests.length}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Pending: ${pendingCount} | Approved: ${approvedCount}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Critical Risk Days: ${criticalDays}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Warning Days: ${warningDays}`, 20, yPosition);
      yPosition += 15;

      // Teams Overview
      doc.setFontSize(14);
      doc.text('Teams Overview', 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      teams.forEach(team => {
        const teamRequests = vacationRequests.filter(vr => vr.team_id === team.id);
        const teamCapacity = capacityData.filter(cd => cd.team_id === team.id);
        const avgCapacity = teamCapacity.length > 0
          ? Math.round(teamCapacity.reduce((sum, cd) => sum + cd.coverage_percentage, 0) / teamCapacity.length)
          : 0;

        doc.text(`${team.name}:`, 20, yPosition);
        yPosition += 6;
        doc.text(`  Vacation Requests: ${teamRequests.length}`, 25, yPosition);
        yPosition += 6;
        doc.text(`  Average Capacity: ${avgCapacity}%`, 25, yPosition);
        yPosition += 8;

        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
      });

      // Footer
      doc.setFontSize(8);
      doc.text(
        `Generated on ${format(new Date(), 'MMM d, yyyy HH:mm')}`,
        20,
        doc.internal.pageSize.height - 10
      );

      const filename = `Vacation-Report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);

      toast({
        title: "Export Successful",
        description: "Report exported to PDF"
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export to PDF",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const exportToCalendar = () => {
    try {
      // Generate iCalendar format
      let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Vacation Planning//EN\n';

      vacationRequests
        .filter(vr => vr.status === 'approved')
        .forEach(req => {
          const dtstart = format(parseISO(req.requested_date), "yyyyMMdd");
          const summary = `${req.profiles?.first_name} ${req.profiles?.last_name} - Vacation`;
          const description = `Team: ${req.teams?.name}${req.notes ? `\\nNotes: ${req.notes}` : ''}`;

          icsContent += 'BEGIN:VEVENT\n';
          icsContent += `DTSTART:${dtstart}\n`;
          icsContent += `DTEND:${dtstart}\n`;
          icsContent += `SUMMARY:${summary}\n`;
          icsContent += `DESCRIPTION:${description}\n`;
          icsContent += 'END:VEVENT\n';
        });

      icsContent += 'END:VCALENDAR';

      // Create download
      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vacation-schedule-${format(new Date(), 'yyyy-MM-dd')}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Calendar file generated"
      });
    } catch (error) {
      console.error('Error exporting calendar:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export calendar",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export & Reports
        </CardTitle>
        <CardDescription>
          Download vacation schedules and capacity analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={exportToExcel}
          disabled={exporting}
          variant="outline"
          className="w-full justify-start"
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>

        <Button
          onClick={exportToPDF}
          disabled={exporting}
          variant="outline"
          className="w-full justify-start"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export to PDF Report
        </Button>

        <Button
          onClick={exportToCalendar}
          disabled={exporting}
          variant="outline"
          className="w-full justify-start"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Export to Calendar (.ics)
        </Button>

        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            Export includes all vacation requests, capacity analysis, and risk assessments
            for the selected date range.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
