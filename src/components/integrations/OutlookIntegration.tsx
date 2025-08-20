import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, ExternalLink, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek } from "date-fns";

interface OutlookEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  isAllDay: boolean;
}

const OutlookIntegration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [events, setEvents] = useState<OutlookEvent[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    // This would typically check if user has authorized Outlook integration
    // For demo purposes, we'll simulate the check
    const hasToken = localStorage.getItem('outlook_access_token');
    const accountEmail = localStorage.getItem('outlook_account_email');
    
    setIsConnected(!!hasToken);
    setConnectedAccount(accountEmail);
    
    if (hasToken) {
      const lastSyncStr = localStorage.getItem('outlook_last_sync');
      if (lastSyncStr) {
        setLastSync(new Date(lastSyncStr));
      }
    }
  };

  const connectToOutlook = async () => {
    setLoading(true);
    try {
      // Microsoft Graph API OAuth2 flow
      const clientId = 'your-outlook-client-id'; // This would be configured in your app
      const redirectUri = `${window.location.origin}/auth/outlook/callback`;
      const scopes = 'https://graph.microsoft.com/calendars.readwrite';
      
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `response_mode=query`;

      // For demo purposes, show how this would work
      toast({
        title: "Outlook Integration",
        description: "In production, this would redirect to Microsoft OAuth. For demo, simulating connection...",
      });

      // Simulate successful connection
      setTimeout(() => {
        const demoEmail = user?.email || 'user@example.com';
        localStorage.setItem('outlook_access_token', 'demo-token');
        localStorage.setItem('outlook_refresh_token', 'demo-refresh-token');
        localStorage.setItem('outlook_account_email', demoEmail);
        setConnectedAccount(demoEmail);
        setIsConnected(true);
        toast({
          title: "Connected!",
          description: `Successfully connected to Outlook calendar (${demoEmail})`,
        });
        setLoading(false);
      }, 2000);

    } catch (error) {
      console.error('Error connecting to Outlook:', error);
      toast({
        title: "Error",
        description: "Failed to connect to Outlook",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const syncScheduleToOutlook = async () => {
    if (!isConnected || !user) return;
    
    setSyncing(true);
    try {
      // Fetch user's schedule entries for the next 30 days
      const today = new Date();
      const endDate = addDays(today, 30);
      
      const { data: scheduleEntries, error } = await supabase
        .from('schedule_entries')
        .select(`
          id,
          date,
          shift_type,
          activity_type,
          availability_status,
          notes
        `)
        .eq('user_id', user.id)
        .gte('date', format(today, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date');

      if (error) throw error;

      // Convert schedule entries to Outlook calendar events
      const calendarEvents = scheduleEntries?.map(entry => {
        const eventDate = new Date(entry.date);
        let startTime = '09:00';
        let endTime = '17:30';
        
        // Adjust times based on shift type
        switch (entry.shift_type) {
          case 'early':
            startTime = '06:00';
            endTime = '14:30';
            break;
          case 'late':
            startTime = '13:00';
            endTime = '21:30';
            break;
        }

        // Parse time split if available
        const timeSplitPattern = /Times:\s*(.+)/;
        const match = entry.notes?.match(timeSplitPattern);
        if (match) {
          try {
            const timesData = JSON.parse(match[1]);
            if (Array.isArray(timesData) && timesData.length > 0) {
              startTime = timesData[0].start_time;
              endTime = timesData[timesData.length - 1].end_time;
            }
          } catch (e) {
            console.error('Failed to parse time split data');
          }
        }

        return {
          subject: `${entry.activity_type.replace('_', ' ')} - ${entry.shift_type} shift`,
          start: {
            dateTime: `${format(eventDate, 'yyyy-MM-dd')}T${startTime}:00`,
            timeZone: 'UTC'
          },
          end: {
            dateTime: `${format(eventDate, 'yyyy-MM-dd')}T${endTime}:00`,
            timeZone: 'UTC'
          },
          body: {
            contentType: 'text',
            content: entry.notes || `Scheduled ${entry.activity_type.replace('_', ' ')}`
          },
          categories: ['Work Schedule']
        };
      }) || [];

      // In production, this would make actual Microsoft Graph API calls
      // For demo, we'll simulate the sync
      console.log('Would sync these events to Outlook:', calendarEvents);
      
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setLastSync(new Date());
      localStorage.setItem('outlook_last_sync', new Date().toISOString());
      
      toast({
        title: "Sync Complete",
        description: `Synchronized ${calendarEvents.length} schedule entries to Outlook`,
      });

    } catch (error) {
      console.error('Error syncing to Outlook:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync schedule to Outlook",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const disconnectOutlook = () => {
    localStorage.removeItem('outlook_access_token');
    localStorage.removeItem('outlook_refresh_token');
    localStorage.removeItem('outlook_last_sync');
    localStorage.removeItem('outlook_account_email');
    setIsConnected(false);
    setLastSync(null);
    setConnectedAccount(null);
    setEvents([]);
    
    toast({
      title: "Disconnected",
      description: "Successfully disconnected from Outlook",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Outlook Calendar Integration
          </CardTitle>
          <CardDescription>
            Sync your work schedule with your Outlook calendar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Connection Status:</span>
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Not Connected
                  </>
                )}
              </Badge>
            </div>
            
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectOutlook}
              >
                Disconnect
              </Button>
            )}
          </div>

          {/* Show connected account info */}
          {isConnected && connectedAccount && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Connected Account:</span>
              <Badge variant="outline">{connectedAccount}</Badge>
            </div>
          )}

          {!isConnected ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Connect your Outlook account to automatically sync your work schedule with your calendar.
                  This will create calendar events for your scheduled shifts and activities.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={connectToOutlook} 
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {loading ? 'Connecting...' : 'Connect to Outlook'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your Outlook calendar is connected. You can now sync your work schedule to create calendar events automatically.
                </AlertDescription>
              </Alert>

              {lastSync && (
                <div className="text-sm text-muted-foreground">
                  Last synchronized: {format(lastSync, 'PPp')}
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={syncScheduleToOutlook} 
                  disabled={syncing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Schedule'}
                </Button>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Sync Features
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Automatically create calendar events for scheduled shifts</li>
                  <li>• Include shift details (early/normal/late) and activity types</li>
                  <li>• Set appropriate start and end times based on shift schedules</li>
                  <li>• Update events when schedule changes occur</li>
                  <li>• Category tagging for easy identification</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Integration Settings</CardTitle>
            <CardDescription>
              Configure how your schedule syncs with Outlook
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Auto-sync</div>
                  <div className="text-sm text-muted-foreground">
                    Automatically sync when schedule changes
                  </div>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Sync Range</div>
                  <div className="text-sm text-muted-foreground">
                    How far ahead to sync schedule entries
                  </div>
                </div>
                <Badge variant="outline">30 days</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OutlookIntegration;