import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileImage, FileText, Calendar, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

interface ScheduleExportProps {
  scheduleData?: any[]; // deprecated; now fetched internally
  currentWeek?: Date;
}

const ScheduleExport: React.FC<ScheduleExportProps> = ({ 
  scheduleData = [], 
  currentWeek = new Date() 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const scheduleRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf'>('pdf');
  const [exportRange, setExportRange] = useState<'current' | 'month'>('current');
  const [entries, setEntries] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const getRange = () => {
    if (exportRange === 'month') {
      const start = startOfMonth(currentWeek);
      const end = endOfMonth(currentWeek);
      return { start, end };
    }
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return { start, end };
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        console.log('ScheduleExport: No user found');
        return;
      }
      setLoadingData(true);
      try {
        const { start, end } = getRange();
        console.log('ScheduleExport: Fetching data for date range:', format(start, 'yyyy-MM-dd'), 'to', format(end, 'yyyy-MM-dd'));
        console.log('ScheduleExport: User ID:', user.id);
        
        const { data, error } = await supabase
          .from('schedule_entries')
          .select('date, shift_type, activity_type, availability_status, notes')
          .eq('user_id', user.id)
          .gte('date', format(start, 'yyyy-MM-dd'))
          .lte('date', format(end, 'yyyy-MM-dd'))
          .order('date');
          
        console.log('ScheduleExport: Query result:', { data, error });
        
        if (error) throw error;
        setEntries(data || []);
        console.log('ScheduleExport: Entries set:', data?.length || 0, 'entries');
      } catch (e) {
        console.error('Failed to load schedule for export', e);
        toast({ title: 'Error', description: 'Could not load schedule data for export', variant: 'destructive' });
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [user, exportRange, currentWeek]);

  const exportAsImage = async () => {
    if (!scheduleRef.current) {
      toast({ title: 'Error', description: 'Nothing to export yet. Try again in a moment.', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      const canvas = await html2canvas(scheduleRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        scrollX: 0,
        scrollY: 0,
      });
      const link = document.createElement('a');
      link.download = `schedule-${format(currentWeek, 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: 'Export Successful', description: 'Schedule exported as image successfully.' });
    } catch (error) {
      console.error('Error exporting as image:', error);
      toast({ title: 'Export Failed', description: 'Failed to export schedule as image.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!scheduleRef.current) {
      toast({ title: 'Error', description: 'Nothing to export yet. Try again in a moment.', variant: 'destructive' });
      return;
    }
    
    console.log('ScheduleExport: Starting PDF export with', entries.length, 'entries');
    console.log('ScheduleExport: Entries data:', entries);
    
    setExporting(true);
    try {
      const canvas = await html2canvas(scheduleRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
      });
      
      console.log('ScheduleExport: Canvas size:', canvas.width, 'x', canvas.height);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`schedule-${format(currentWeek, 'yyyy-MM-dd')}.pdf`);
      toast({ title: 'Export Successful', description: 'Schedule exported as PDF successfully.' });
    } catch (error) {
      console.error('Error exporting as PDF:', error);
      toast({ title: 'Export Failed', description: 'Failed to export schedule as PDF.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const exportAsExcel = () => {
    setExporting(true);
    try {
      const { start } = getRange();
      const worksheetData = [
        ['My Schedule Export'],
        [`Week of ${format(start, 'MMM dd')} - ${exportRange === 'month' ? 'Full Month' : format(addDays(start, 6), 'MMM dd, yyyy')}`],
        [''],
        ['Date', 'Day', 'Shift Type', 'Activity', 'Status', 'Notes'],
        ...entries.map((entry) => {
          const entryDate = new Date(entry.date);
          return [
            format(entryDate, 'yyyy-MM-dd'),
            format(entryDate, 'EEEE'),
            entry.shift_type || '',
            entry.activity_type || '',
            entry.availability_status || '',
            entry.notes || ''
          ];
        })
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      ws['!cols'] = [
        { width: 12 }, { width: 12 }, { width: 12 }, 
        { width: 16 }, { width: 12 }, { width: 40 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'My Schedule');
      const fileName = `my-schedule-${format(currentWeek, 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({ title: 'Export Successful', description: 'Schedule exported as Excel successfully.' });
    } catch (error) {
      console.error('Error exporting as Excel:', error);
      toast({ title: 'Export Failed', description: 'Failed to export schedule as Excel.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const exportAsJSON = () => {
    setExporting(true);
    try {
      const { start, end } = getRange();
      
      const exportData = {
        metadata: {
          export_date: new Date().toISOString(),
          user_id: user?.id,
          date_range: {
            start: format(start, 'yyyy-MM-dd'),
            end: format(end, 'yyyy-MM-dd')
          },
          version: '1.0'
        },
        schedule_entries: entries.map(entry => ({
          date: entry.date,
          shift_type: entry.shift_type,
          activity_type: entry.activity_type,
          availability_status: entry.availability_status,
          notes: entry.notes || null
        }))
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `schedule-${format(start, 'yyyy-MM-dd')}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'Export Successful', description: 'Schedule exported as JSON successfully.' });
    } catch (error) {
      console.error('Error exporting JSON:', error);
      toast({ title: 'Export Failed', description: 'Failed to export as JSON.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const exportAsVisualCalendarPDF = async () => {
    setExporting(true);
    try {
      const { start, end } = getRange();
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      // Title
      pdf.setFontSize(18);
      pdf.text(`Schedule: ${format(start, 'MMM dd')} - ${format(end, 'MMM dd, yyyy')}`, 15, 20);
      
      // Calendar grid setup
      let yPos = 35;
      const colWidth = 38;
      const rowHeight = 25;
      
      // Draw days of week headers
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'bold');
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      days.forEach((day, idx) => {
        pdf.text(day, 15 + (idx * colWidth) + 2, yPos);
      });
      
      // Draw entries
      yPos += 5;
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(8);
      
      let currentDate = new Date(start);
      let row = 0;
      
      while (currentDate <= end) {
        const dayIdx = (currentDate.getDay() + 6) % 7; // Mon=0, Sun=6
        const entry = entries.find(e => e.date === format(currentDate, 'yyyy-MM-dd'));
        
        const xPos = 15 + (dayIdx * colWidth);
        const cellY = yPos + (row * rowHeight);
        
        // Draw cell border
        pdf.rect(xPos, cellY, colWidth, rowHeight);
        
        // Date number
        pdf.setFontSize(10);
        pdf.text(format(currentDate, 'd'), xPos + 2, cellY + 5);
        
        // Entry details if exists
        if (entry) {
          pdf.setFontSize(7);
          pdf.text(entry.shift_type || '', xPos + 2, cellY + 11);
          pdf.text(entry.activity_type || '', xPos + 2, cellY + 16);
        }
        
        currentDate = addDays(currentDate, 1);
        if (dayIdx === 6) row++;
      }
      
      pdf.save(`calendar-${format(start, 'yyyy-MM-dd')}.pdf`);
      toast({ title: 'Export Successful', description: 'Calendar exported as PDF successfully.' });
    } catch (error) {
      console.error('Error exporting calendar PDF:', error);
      toast({ title: 'Export Failed', description: 'Failed to export calendar.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const exportToCalendar = () => {
    setExporting(true);
    try {
      if (!entries || entries.length === 0) {
        toast({
          title: "No Data",
          description: "No schedule entries to export",
          variant: "destructive"
        });
        setExporting(false);
        return;
      }

      let icsContent = 'BEGIN:VCALENDAR\n';
      icsContent += 'VERSION:2.0\n';
      icsContent += 'PRODID:-//My Schedule Export//EN\n';
      icsContent += 'CALSCALE:GREGORIAN\n';

      entries.forEach(entry => {
        const date = new Date(entry.date);
        const dateStr = format(date, 'yyyyMMdd');
        const shiftType = entry.shift_type || 'normal';
        const activityType = entry.activity_type || 'work';

        icsContent += 'BEGIN:VEVENT\n';
        icsContent += `DTSTART;VALUE=DATE:${dateStr}\n`;
        icsContent += `DTEND;VALUE=DATE:${dateStr}\n`;
        icsContent += `SUMMARY:${shiftType} - ${activityType}\n`;
        icsContent += `DESCRIPTION:Shift: ${shiftType}\\nActivity: ${activityType}\\nAvailability: ${entry.availability_status}`;
        if (entry.notes) {
          icsContent += `\\nNotes: ${entry.notes.replace(/\n/g, '\\n')}`;
        }
        icsContent += '\n';
        icsContent += `UID:schedule-${dateStr}-${user?.id}@schedule-export\n`;
        icsContent += `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}\n`;
        icsContent += 'END:VEVENT\n';
      });

      icsContent += 'END:VCALENDAR';

      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const { start, end } = getRange();
      link.download = `my-schedule-${format(start, 'yyyy-MM-dd')}.ics`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Exported ${entries.length} schedule entries to calendar (ICS file)`
      });
    } catch (error) {
      console.error('Error exporting to calendar:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export to calendar",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    exportAsPDF();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Schedule
        </CardTitle>
        <CardDescription>
          Download your schedule in various formats for offline viewing or sharing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Export Format</label>
            <Select value={exportFormat} onValueChange={(value: 'pdf') => setExportFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF Document
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <Select value={exportRange} onValueChange={(value: 'current' | 'month') => setExportRange(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Week</SelectItem>
                <SelectItem value="month">Current Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={handleExport} 
              disabled={exporting || loadingData}
              className="flex items-center gap-2"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              PDF (Screenshot)
            </Button>

            <Button 
              onClick={exportAsVisualCalendarPDF} 
              disabled={exporting || loadingData}
              variant="outline"
              className="flex items-center gap-2"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
              PDF (Calendar)
            </Button>

            <Button 
              onClick={exportAsExcel} 
              disabled={exporting || loadingData}
              variant="outline"
              className="flex items-center gap-2"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Excel
            </Button>

            <Button 
              onClick={exportToCalendar} 
              disabled={exporting || loadingData}
              variant="outline"
              className="flex items-center gap-2"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
              ICS Calendar
            </Button>
          </div>
          
          {entries.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Ready to export {entries.length} schedule entries
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="secondary" className="text-xs">PDF: Screenshot or calendar view</Badge>
          <Badge variant="secondary" className="text-xs">Excel: Spreadsheet format</Badge>
          <Badge variant="secondary" className="text-xs">JSON: API integration</Badge>
        </div>

        {/* Hidden div to capture schedule for export - positioned off-screen but rendered */}
        <div className="absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none">
          <div ref={scheduleRef} className="bg-white p-6 w-[1024px]">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                My Schedule - {exportRange === 'month' ? 'Month' : 'Week'} of {format(currentWeek, 'MMM dd, yyyy')}
              </h1>
              <p className="text-gray-600">
                {exportRange === 'month' 
                  ? `Month: ${format(getRange().start, 'MMM yyyy')}`
                  : `Week of ${format(getRange().start, 'MMM dd')} - ${format(getRange().end, 'MMM dd, yyyy')}`
                }
              </p>
            </div>
            
            <div className="space-y-4">
              {loadingData ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-lg">Loading schedule data...</p>
                </div>
              ) : entries.length > 0 ? (
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Date</th>
                      <th className="border border-gray-300 p-2 text-left">Day</th>
                      <th className="border border-gray-300 p-2 text-left">Shift</th>
                      <th className="border border-gray-300 p-2 text-left">Activity</th>
                      <th className="border border-gray-300 p-2 text-left">Status</th>
                      <th className="border border-gray-300 p-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">
                          {format(new Date(entry.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="border border-gray-300 p-2">
                          {format(new Date(entry.date), 'EEEE')}
                        </td>
                        <td className="border border-gray-300 p-2">{entry.shift_type || '-'}</td>
                        <td className="border border-gray-300 p-2">{entry.activity_type || '-'}</td>
                        <td className="border border-gray-300 p-2">{entry.availability_status || '-'}</td>
                        <td className="border border-gray-300 p-2">{entry.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 text-lg">No schedule entries found for this period.</p>
                  <p className="text-gray-500 text-sm mt-2">Date range: {format(getRange().start, 'MMM dd')} - {format(getRange().end, 'MMM dd, yyyy')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleExport;