import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Clock, Calendar, Briefcase, User, Home, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfYear, endOfYear, differenceInDays, parseISO } from "date-fns";
import * as XLSX from 'xlsx';
import { formatUserName, cn } from "@/lib/utils";
import { ShiftLimitTracker } from "@/components/schedule/ShiftLimitTracker";
import { useHomeOfficeCompliance } from "@/hooks/useHomeOfficeCompliance";
interface UserProfileOverviewProps {
  userId: string;
  canView: boolean; // Only planners and managers can view
  teamId?: string; // Optional team context for filtering
  showTeamContext?: boolean; // Show which team this user belongs to
}

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
  country_code: string;
  initials?: string;
}

interface WorkSummary {
  totalWorkDays: number;
  vacationDays: number;
  homeOfficeDays: number;
  totalHours: number;
  availableDays: number;
  unavailableDays: number;
}

const UserProfileOverview: React.FC<UserProfileOverviewProps> = ({ userId, canView, teamId, showTeamContext = true }) => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [workSummary, setWorkSummary] = useState<WorkSummary | null>(null);
  const [userTeams, setUserTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingCSV, setDownloadingCSV] = useState(false);

  // Home Office compliance hook
  const { compliance: hoCompliance, loading: hoLoading } = useHomeOfficeCompliance({
    userId,
    countryCode: profile?.country_code,
  });

  useEffect(() => {
    if (canView && userId) {
      fetchProfileData();
      fetchWorkSummary();
      if (showTeamContext) {
        fetchUserTeams();
      }
    }
  }, [userId, canView, showTeamContext]);

  const fetchProfileData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, country_code, initials')
        .eq('user_id', userId)
        .single() as any;

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchUserTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          teams (
            id,
            name,
            description
          ),
          is_manager
        `)
        .eq('user_id', userId);

      if (error) throw error;
      setUserTeams(data || []);
    } catch (error) {
      console.error('Error fetching user teams:', error);
    }
  };

  const fetchWorkSummary = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd');
      const yearEnd = format(endOfYear(new Date()), 'yyyy-MM-dd');

      let query = supabase
        .from('schedule_entries')
        .select(`
          date,
          activity_type,
          availability_status,
          shift_type,
          notes,
          team_id
        `)
        .eq('user_id', userId)
        .gte('date', yearStart)
        .lte('date', yearEnd);

      // Apply team filter if specified
      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate work summary
      const summary: WorkSummary = {
        totalWorkDays: 0,
        vacationDays: 0,
        homeOfficeDays: 0,
        totalHours: 0,
        availableDays: 0,
        unavailableDays: 0
      };

      data?.forEach(entry => {
        switch (entry.activity_type) {
          case 'work':
            summary.totalWorkDays++;
            // Calculate hours based on time split or default 8 hours
            const hours = calculateHoursFromEntry(entry);
            summary.totalHours += hours;
            break;
          case 'vacation':
            summary.vacationDays++;
            break;
          case 'working_from_home':
            summary.homeOfficeDays++;
            summary.totalWorkDays++;
            const homeOfficeHours = calculateHoursFromEntry(entry);
            summary.totalHours += homeOfficeHours;
            break;
          case 'hotline_support':
          case 'flextime':
            summary.totalWorkDays++;
            const workingHours = calculateHoursFromEntry(entry);
            summary.totalHours += workingHours;
            break;
        }

        if (entry.availability_status === 'available') {
          summary.availableDays++;
        } else {
          summary.unavailableDays++;
        }
      });

      setWorkSummary(summary);
    } catch (error) {
      console.error('Error fetching work summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateHoursFromEntry = (entry: any): number => {
    // Check if entry has time split information
    const timeSplitPattern = /Times:\s*(.+)/;
    const match = entry.notes?.match(timeSplitPattern);
    
    if (match) {
      try {
        const timesData = JSON.parse(match[1]);
        if (Array.isArray(timesData)) {
          return timesData.reduce((total, block) => {
            const start = new Date(`2000-01-01T${block.start_time}:00`);
            const end = new Date(`2000-01-01T${block.end_time}:00`);
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            return total + hours;
          }, 0);
        }
      } catch (e) {
        console.error('Failed to parse time split data');
      }
    }
    
    // Default hours based on shift type
    switch (entry.shift_type) {
      case 'early':
        return 8; // Assume 8 hours for early shift
      case 'late':
        return 8; // Assume 8 hours for late shift
      case 'normal':
      default:
        return 8; // Default 8 hours
    }
  };

  const downloadExcel = async () => {
    if (!profile || !workSummary) return;
    
    setDownloadingCSV(true);
    try {
      // Fetch detailed schedule data
      const currentYear = new Date().getFullYear();
      const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd');
      const yearEnd = format(endOfYear(new Date()), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('date', yearStart)
        .lte('date', yearEnd)
        .order('date');

      if (error) throw error;

      // Prepare worksheet data
      const worksheetData = [
        ['Employee Schedule Report'],
        [`Name: ${formatUserName(profile.first_name, profile.last_name, profile.initials)}`],
        [`Year: ${currentYear}`],
        [''],
        ['Date', 'Activity Type', 'Shift Type', 'Availability Status', 'Hours', 'Notes'],
        ...(data?.map(entry => [
          entry.date,
          entry.activity_type.replace('_', ' '),
          entry.shift_type,
          entry.availability_status,
          calculateHoursFromEntry(entry),
          entry.notes || ''
        ]) || []),
        [''],
        ['Summary:'],
        ['Total Work Days', workSummary.totalWorkDays],
        ['Total Hours', workSummary.totalHours.toFixed(1)],
        ['Home Office Days', workSummary.homeOfficeDays],
        ['Vacation Days', workSummary.vacationDays]
      ];

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths
      ws['!cols'] = [
        { width: 12 }, // Date
        { width: 15 }, // Activity Type
        { width: 12 }, // Shift Type
        { width: 18 }, // Availability Status
        { width: 8 },  // Hours
        { width: 30 }  // Notes
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
      
      // Generate Excel file and download
      const fileName = `${formatUserName(profile.first_name, profile.last_name, profile.initials).replace(/\s+/g, '_')}_Schedule_${currentYear}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Success",
        description: "Excel file downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast({
        title: "Error",
        description: "Failed to download Excel file",
        variant: "destructive"
      });
    } finally {
      setDownloadingCSV(false);
    }
  };

  const downloadPDF = async () => {
    if (!profile || !workSummary) return;
    
    setDownloadingPDF(true);
    try {
      // Create a simple HTML content for PDF generation
      const htmlContent = `
        <html>
          <head>
            <title>Employee Schedule Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .summary { margin-bottom: 30px; }
              .summary-item { margin: 10px 0; }
              .bold { font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Employee Schedule Report</h1>
              <h2>${formatUserName(profile.first_name, profile.last_name, profile.initials)}</h2>
              <p>Year: ${new Date().getFullYear()}</p>
            </div>
            <div class="summary">
              <h3>Work Summary</h3>
              <div class="summary-item"><span class="bold">Total Work Days:</span> ${workSummary.totalWorkDays}</div>
              <div class="summary-item"><span class="bold">Total Hours:</span> ${workSummary.totalHours.toFixed(1)}</div>
              <div class="summary-item"><span class="bold">Home Office Days:</span> ${workSummary.homeOfficeDays}</div>
              <div class="summary-item"><span class="bold">Vacation Days:</span> ${workSummary.vacationDays}</div>
              <div class="summary-item"><span class="bold">Available Days:</span> ${workSummary.availableDays}</div>
              <div class="summary-item"><span class="bold">Unavailable Days:</span> ${workSummary.unavailableDays}</div>
            </div>
          </body>
        </html>
      `;

      // Use browser's print functionality to save as PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }

      toast({
        title: "Success",
        description: "PDF report opened in new window. Use your browser's print function to save as PDF."
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive"
      });
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            You don't have permission to view this user's profile overview.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p>Loading profile overview...</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile || !workSummary) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No data available for this user.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Profile Overview - {formatUserName(profile.first_name, profile.last_name, profile.initials)}
            </CardTitle>
            <CardDescription>
              Work summary and time tracking for {new Date().getFullYear()}
              {showTeamContext && userTeams.length > 0 && (
                <div className="mt-2">
                  <span className="font-medium">Teams: </span>
                  {userTeams.map((tm, index) => (
                    <Badge key={tm.teams.id} variant="outline" className="ml-1">
                      {tm.teams.name}
                      {tm.is_manager && <span className="ml-1 text-xs">(Manager)</span>}
                    </Badge>
                  ))}
                </div>
              )}
            </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <div className="flex items-center">
                <Briefcase className="w-4 h-4 mr-2 text-blue-500" />
                <span className="text-sm font-medium">Work Days</span>
              </div>
              <div className="text-2xl font-bold">{workSummary.totalWorkDays}</div>
              <div className="text-xs text-muted-foreground">
                {workSummary.totalHours.toFixed(1)} hours total
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <Home className="w-4 h-4 mr-2 text-green-500" />
                <span className="text-sm font-medium">Home Office</span>
              </div>
              <div className="text-2xl font-bold flex items-center gap-2">
                {workSummary.homeOfficeDays}
                {/* Show HO compliance badge */}
                {hoCompliance && hoCompliance.limitType !== 'none' && (
                  hoCompliance.isOverLimit ? (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Over
                    </Badge>
                  ) : hoCompliance.isApproachingLimit ? (
                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {Math.round(hoCompliance.percentUsed)}%
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
                      <CheckCircle className="w-3 h-3" />
                      OK
                    </Badge>
                  )
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {hoCompliance && hoCompliance.limitType !== 'none' ? (
                  <>
                    {hoCompliance.currentPeriodDays}/{hoCompliance.maxDays} this {hoCompliance.limitType === 'weekly' ? 'week' : hoCompliance.limitType === 'monthly' ? 'month' : 'year'}
                    {hoCompliance.limitType !== 'yearly' && (
                      <span className="ml-1">({hoCompliance.yearToDateDays} YTD)</span>
                    )}
                  </>
                ) : (
                  'days this year'
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-orange-500" />
                <span className="text-sm font-medium">Vacation</span>
              </div>
              <div className="text-2xl font-bold">{workSummary.vacationDays}</div>
              <div className="text-xs text-muted-foreground">days taken</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Availability Rate</span>
                <span className="text-sm text-muted-foreground">
                  {workSummary.availableDays + workSummary.unavailableDays > 0 
                    ? Math.round((workSummary.availableDays / (workSummary.availableDays + workSummary.unavailableDays)) * 100)
                    : 0}%
                </span>
              </div>
              <Progress 
                value={workSummary.availableDays + workSummary.unavailableDays > 0 
                  ? (workSummary.availableDays / (workSummary.availableDays + workSummary.unavailableDays)) * 100
                  : 0} 
                className="h-2"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={downloadExcel} 
                disabled={downloadingCSV}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                {downloadingCSV ? 'Downloading...' : 'Download Excel'}
              </Button>
              <Button 
                onClick={downloadPDF} 
                disabled={downloadingPDF}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                {downloadingPDF ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shift Limit Tracker */}
      {profile.country_code && (
        <ShiftLimitTracker
          userId={userId}
          countryCode={profile.country_code}
          year={new Date().getFullYear()}
        />
      )}
    </div>
  );
};

export default UserProfileOverview;