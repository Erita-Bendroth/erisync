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
      if (!user) return;
      setLoadingData(true);
      try {
        const { start, end } = getRange();
        const { data, error } = await supabase
          .from('schedule_entries')
          .select('date, shift_type, activity_type, availability_status, notes')
          .eq('user_id', user.id)
          .gte('date', format(start, 'yyyy-MM-dd'))
          .lte('date', format(end, 'yyyy-MM-dd'))
          .order('date');
        if (error) throw error;
        setEntries(data || []);
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
    setExporting(true);
    try {
      const canvas = await html2canvas(scheduleRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
      });
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
      // Prepare worksheet data for the current user
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
        { width: 12 }, // Date
        { width: 12 }, // Day
        { width: 12 }, // Shift Type
        { width: 16 }, // Activity
        { width: 12 }, // Status
        { width: 40 }  // Notes
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

        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleExport} 
            disabled={exporting}
            className="flex items-center gap-2"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export as {exportFormat.toUpperCase()}
          </Button>

          <Button 
            onClick={exportAsExcel} 
            disabled={exporting}
            variant="outline"
            className="flex items-center gap-2"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Export Excel
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            PDF: Printable document
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Excel: Spreadsheet data
          </Badge>
        </div>

        {/* Hidden div to capture schedule for export - positioned off-screen but rendered */}
        <div ref={scheduleRef} className="absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none">
          <div className="bg-white p-6 min-w-[800px]">
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
              {entries.length > 0 ? (
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
                        <td className="border border-gray-300 p-2">{entry.shift_type}</td>
                        <td className="border border-gray-300 p-2">{entry.activity_type}</td>
                        <td className="border border-gray-300 p-2">{entry.availability_status}</td>
                        <td className="border border-gray-300 p-2">{entry.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 text-lg">No schedule entries for this period.</p>
                  {loadingData && <p className="text-gray-500 mt-2">Loading schedule data...</p>}
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