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
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const storedState = sessionStorage.getItem("oauth_state"); // Use sessionStorage instead of localStorage for security

    if (code && state && state === storedState) {
      setLoading(true);
      try {
        // Exchange authorization code for tokens via secure edge function
        const { data, error } = await supabase.functions.invoke("exchange-outlook-token", {
          body: {
            code,
            redirectUri: `${window.location.origin}/auth`,
          },
        });

        if (error) throw error;

        // Check connection status after successful exchange
        await checkConnectionStatus();

        toast({
          title: "Connected!",
          description: "Successfully connected to Outlook calendar",
        });

        // Clean up
        sessionStorage.removeItem("oauth_state");
        // Remove query parameters from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error: any) {
        console.error("OAuth callback error:", error);
        toast({
          title: "Connection Failed",
          description: error.message || "Failed to complete Outlook connection",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const checkConnectionStatus = async () => {
    if (!user) return;

    try {
      // Check connection status via secure server-side API
      const { data, error } = await supabase.functions.invoke("oauth-token-manager/outlook", {
        method: "GET",
      });

      if (error) {
        console.error("Error checking connection status:", error);
        setIsConnected(false);
        return;
      }

      setIsConnected(data.exists);

      if (data.exists && data.created_at) {
        setLastSync(new Date(data.created_at));
      }

      // Get account info if connected
      if (data.exists) {
        try {
          const { data: userInfo, error: userError } = await supabase.functions.invoke("outlook-graph-proxy", {
            body: { endpoint: "/me", method: "GET" },
          });

          if (!userError && userInfo) {
            setConnectedAccount(userInfo.mail || userInfo.userPrincipalName);
          }
        } catch (err) {
          console.error("Error fetching user info:", err);
        }
      }
    } catch (error) {
      console.error("Error in checkConnectionStatus:", error);
      setIsConnected(false);
    }
  };

  const connectToOutlook = async () => {
    setLoading(true);
    try {
      // Azure AD App Configuration - use Vestas tenant
      const clientId = "9c1e8b69-8746-4aaa-a968-7d3de62be7c9";
      const tenantId = "c0701940-7b3f-4116-a59f-159078bc3c63"; // Vestas tenant ID
      const redirectUri = `${window.location.origin}/auth`;
      const scopes = encodeURIComponent("https://graph.microsoft.com/Calendars.ReadWrite offline_access User.Read");

      console.log("Using redirect URI:", redirectUri);

      // Generate state parameter for security
      const state = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem("oauth_state", state); // Use sessionStorage instead of localStorage

      // Build Azure AD authorization URL with tenant-specific endpoint
      const authUrl =
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${scopes}` +
        `&state=${state}`;

      console.log("Redirecting to:", authUrl);

      // Show user the redirect URI they need to configure
      toast({
        title: "Azure AD Configuration Required",
        description: `Please ensure ${redirectUri} is configured as a redirect URI in your Azure AD app registration`,
        variant: "default",
      });

      // Redirect to Azure AD for authentication
      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Error connecting to Outlook:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to connect to Outlook.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const syncScheduleToOutlook = async () => {
    if (!isConnected || !user) return;

    setSyncing(true);
    try {
      // Get user's timezone from profile
      const { data: profile } = await supabase.from("profiles").select("country_code").eq("user_id", user.id).single();

      // Map country to timezone
      const getTimezone = (countryCode: string) => {
        const timezones: { [key: string]: string } = {
          US: "America/New_York",
          SE: "Europe/Stockholm",
          DK: "Europe/Copenhagen",
          NO: "Europe/Oslo",
          FI: "Europe/Helsinki",
          DE: "Europe/Berlin",
          FR: "Europe/Paris",
          GB: "Europe/London",
        };
        return timezones[countryCode] || "UTC";
      };

      const timezone = getTimezone(profile?.country_code || "US");

      // Fetch user's schedule entries for the next 30 days
      const today = new Date();
      const endDate = addDays(today, 30);

      const { data: scheduleEntries, error } = await supabase
        .from("schedule_entries")
        .select("id, date, shift_type, activity_type, availability_status, notes")
        .eq("user_id", user.id)
        .gte("date", format(today, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"))
        .order("date");

      if (error) throw error;

      // Check for existing events to avoid duplicates
      const { data: existingEventsData, error: eventsError } = await supabase.functions.invoke("outlook-graph-proxy", {
        body: {
          endpoint: `/me/calendar/events?$filter=categories/any(c:c eq 'Work Schedule')&$select=id,subject,start,end`,
          method: "GET",
        },
      });

      if (eventsError) {
        console.error("Error fetching existing events:", eventsError);
      }

      const existingEvents = existingEventsData?.value || [];
      let createdCount = 0;

      // Create calendar events for each schedule entry
      for (const entry of scheduleEntries || []) {
        const eventDate = new Date(entry.date);
        let startTime = "08:00";
        let endTime = "16:30";

        // Adjust times based on shift type
        switch (entry.shift_type) {
          case "early":
            startTime = "06:00";
            endTime = "14:30";
            break;
          case "late":
            startTime = "13:00";
            endTime = "21:30";
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
            console.error("Failed to parse time split data");
          }
        }

        const eventSubject = `${entry.activity_type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} - ${entry.shift_type} shift`;

        // Check if event already exists
        const eventExists = existingEvents.some(
          (existing: any) =>
            existing.subject === eventSubject && existing.start.dateTime.includes(format(eventDate, "yyyy-MM-dd")),
        );

        if (!eventExists) {
          const calendarEvent = {
            subject: eventSubject,
            start: {
              dateTime: `${format(eventDate, "yyyy-MM-dd")}T${startTime}:00`,
              timeZone: timezone,
            },
            end: {
              dateTime: `${format(eventDate, "yyyy-MM-dd")}T${endTime}:00`,
              timeZone: timezone,
            },
            body: {
              contentType: "text",
              content: entry.notes || `Scheduled ${entry.activity_type.replace("_", " ")}`,
            },
            categories: ["Work Schedule"],
          };

          // Create the event via secure proxy
          const { data: createResponse, error: createError } = await supabase.functions.invoke("outlook-graph-proxy", {
            body: {
              endpoint: "/me/calendar/events",
              method: "POST",
              data: calendarEvent,
            },
          });

          if (!createError && createResponse) {
            createdCount++;
          } else {
            console.error("Failed to create event:", createError);
          }
        }
      }

      setLastSync(new Date());

      toast({
        title: "Sync Complete",
        description: `Created ${createdCount} new calendar events in Outlook`,
      });
    } catch (error: any) {
      console.error("Error syncing to Outlook:", error);

      // Handle token errors
      if (error.message?.includes("Token expired") || error.message?.includes("Outlook not connected")) {
        setIsConnected(false);
        toast({
          title: "Connection Lost",
          description: "Please reconnect to Outlook to refresh your access",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sync Failed",
          description: error.message || "Failed to sync schedule to Outlook",
          variant: "destructive",
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  const disconnectOutlook = async () => {
    try {
      // Remove tokens from secure server-side storage
      const { error } = await supabase.functions.invoke("oauth-token-manager/outlook", {
        method: "DELETE",
      });

      if (error) {
        console.error("Error disconnecting from server:", error);
      }
    } catch (error) {
      console.error("Error during disconnect:", error);
    }

    // Clean up local state
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
          <CardDescription>Sync your work schedule with your Outlook calendar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Work in Progress:</strong> Outlook Calendar integration is currently under development and not
              supported at this time.
            </AlertDescription>
          </Alert>

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
              <Button variant="outline" size="sm" onClick={disconnectOutlook}>
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
                  Connect your Outlook account to automatically sync your work schedule with your calendar. This will
                  create calendar events for your scheduled shifts and activities.
                </AlertDescription>
              </Alert>

              <Button onClick={connectToOutlook} disabled={loading} className="w-full sm:w-auto">
                <ExternalLink className="w-4 h-4 mr-2" />
                {loading ? "Connecting..." : "Connect to Outlook"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your Outlook calendar is connected. You can now sync your work schedule to create calendar events
                  automatically.
                </AlertDescription>
              </Alert>

              {lastSync && (
                <div className="text-sm text-muted-foreground">Last synchronized: {format(lastSync, "PPp")}</div>
              )}

              <div className="flex gap-2">
                <Button onClick={syncScheduleToOutlook} disabled={syncing}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync Schedule"}
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
            <CardDescription>Configure how your schedule syncs with Outlook</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Auto-sync</div>
                  <div className="text-sm text-muted-foreground">Automatically sync when schedule changes</div>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Sync Range</div>
                  <div className="text-sm text-muted-foreground">How far ahead to sync schedule entries</div>
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
