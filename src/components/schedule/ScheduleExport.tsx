import React, { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileImage, FileText, Calendar, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, addDays, startOfWeek } from 'date-fns';
import * as XLSX from 'xlsx';

interface ScheduleExportProps {
  scheduleData?: any[];
  currentWeek?: Date;
}

const ScheduleExport: React.FC<ScheduleExportProps> = ({ 
  scheduleData = [], 
  currentWeek = new Date() 
}) => {
  const { toast } = useToast();
  const scheduleRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf'>('png');
  const [exportRange, setExportRange] = useState<'current' | 'month'>('current');

  const exportAsImage = async () => {
    const scheduleContainer = document.querySelector('.schedule-view-container') as HTMLElement;
    
    if (!scheduleContainer) {
      toast({
        title: "Error",
        description: "Schedule view not found. Please make sure the schedule is visible.",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const canvas = await html2canvas(scheduleContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        scrollX: 0,
        scrollY: 0,
        width: scheduleContainer.scrollWidth,
        height: scheduleContainer.scrollHeight
      });

      const link = document.createElement('a');
      link.download = `schedule-${format(currentWeek, 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({
        title: "Export Successful",
        description: "Schedule exported as image successfully.",
      });
    } catch (error) {
      console.error('Error exporting as image:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export schedule as image. Please ensure the schedule is fully loaded.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportAsPDF = async () => {
    const scheduleContainer = document.querySelector('.schedule-view-container') as HTMLElement;
    
    if (!scheduleContainer) {
      toast({
        title: "Error",
        description: "Schedule view not found. Please make sure the schedule is visible.",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const canvas = await html2canvas(scheduleContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        width: scheduleContainer.scrollWidth,
        height: scheduleContainer.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`schedule-${format(currentWeek, 'yyyy-MM-dd')}.pdf`);

      toast({
        title: "Export Successful",
        description: "Schedule exported as PDF successfully.",
      });
    } catch (error) {
      console.error('Error exporting as PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export schedule as PDF. Please ensure the schedule is fully loaded.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportAsExcel = () => {
    setExporting(true);
    try {
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
      
      // Prepare worksheet data
      const worksheetData = [
        ['Weekly Schedule Export'],
        [`Week of ${format(weekStart, 'MMM dd')} - ${format(addDays(weekStart, 6), 'MMM dd, yyyy')}`],
        [''],
        ['Employee', 'Date', 'Day', 'Shift Type', 'Activity', 'Status', 'Notes'],
        ...(scheduleData.map(entry => {
          const entryDate = new Date(entry.date);
          return [
            `${entry.profiles?.first_name || 'Unknown'} ${entry.profiles?.last_name || 'User'}`,
            format(entryDate, 'yyyy-MM-dd'),
            format(entryDate, 'EEEE'),
            entry.shift_type || '',
            entry.activity_type || '',
            entry.availability_status || '',
            entry.notes || ''
          ];
        }))
      ];

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths
      ws['!cols'] = [
        { width: 20 }, // Employee
        { width: 12 }, // Date
        { width: 10 }, // Day
        { width: 12 }, // Shift Type
        { width: 15 }, // Activity
        { width: 12 }, // Status
        { width: 30 }  // Notes
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
      
      // Generate Excel file and download
      const fileName = `schedule-${format(currentWeek, 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export Successful",
        description: "Schedule exported as Excel successfully.",
      });
    } catch (error) {
      console.error('Error exporting as Excel:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export schedule as Excel.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    switch (exportFormat) {
      case 'png':
        exportAsImage();
        break;
      case 'pdf':
        exportAsPDF();
        break;
      default:
        exportAsImage();
    }
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
            <Select value={exportFormat} onValueChange={(value: 'png' | 'pdf') => setExportFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-4 h-4" />
                    PNG Image
                  </div>
                </SelectItem>
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
            <FileImage className="w-3 h-3" />
            PNG: High quality image
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            PDF: Printable document
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Excel: Spreadsheet data
          </Badge>
        </div>

        {/* Hidden div to capture schedule for export */}
        <div ref={scheduleRef} className="hidden">
          <div className="bg-white p-6 min-w-[800px]">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Weekly Schedule - {format(currentWeek, 'MMM dd, yyyy')}
              </h1>
              <p className="text-gray-600">
                Week of {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM dd')} - {format(addDays(startOfWeek(currentWeek, { weekStartsOn: 1 }), 6), 'MMM dd, yyyy')}
              </p>
            </div>
            
            <div className="space-y-4">
              {scheduleData.length > 0 ? (
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Employee</th>
                      <th className="border border-gray-300 p-2 text-left">Date</th>
                      <th className="border border-gray-300 p-2 text-left">Shift</th>
                      <th className="border border-gray-300 p-2 text-left">Activity</th>
                      <th className="border border-gray-300 p-2 text-left">Status</th>
                      <th className="border border-gray-300 p-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleData.map((entry, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">
                          {entry.profiles?.first_name} {entry.profiles?.last_name}
                        </td>
                        <td className="border border-gray-300 p-2">
                          {format(new Date(entry.date), 'MMM dd, yyyy')}
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
                <p className="text-gray-600 text-center py-8">No schedule entries for this period.</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleExport;