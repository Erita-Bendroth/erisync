import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NotificationPreferences {
  inAppNotifications: boolean;
  desktopNotifications: boolean;
  scheduleChanges: boolean;
  weeklyReminders: boolean;
  teamUpdates: boolean;
}

const NotificationSettings = () => {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    inAppNotifications: true,
    desktopNotifications: false,
    scheduleChanges: true,
    weeklyReminders: true,
    teamUpdates: true,
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    // Check current notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Load saved preferences from localStorage
    const savedPrefs = localStorage.getItem('notificationPreferences');
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    }
  }, []);

  const savePreferences = (newPrefs: NotificationPreferences) => {
    setPreferences(newPrefs);
    localStorage.setItem('notificationPreferences', JSON.stringify(newPrefs));
    toast({
      title: "Preferences Saved",
      description: "Your notification settings have been updated.",
    });
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast({
        title: "Not Supported",
        description: "Desktop notifications are not supported in your browser.",
        variant: "destructive",
      });
      return;
    }

    // Check if we're on a secure context (HTTPS)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      toast({
        title: "HTTPS Required",
        description: "Desktop notifications only work on secure (HTTPS) connections.",
        variant: "destructive",
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        savePreferences({ ...preferences, desktopNotifications: true });
        toast({
          title: "Permission Granted",
          description: "Desktop notifications are now enabled. You'll receive alerts for schedule changes.",
        });
      } else if (permission === 'denied') {
        savePreferences({ ...preferences, desktopNotifications: false });
        toast({
          title: "Permission Denied",
          description: "Please enable notifications in your browser settings to receive alerts.",
          variant: "destructive",
        });
      } else {
        // Permission was dismissed
        savePreferences({ ...preferences, desktopNotifications: false });
        toast({
          title: "Permission Not Set",
          description: "You can enable notifications later in your browser settings.",
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: "Error",
        description: "Failed to request notification permission. Please try again.",
        variant: "destructive",
      });
    }
  };

  const testDesktopNotification = async () => {
    if (notificationPermission !== 'granted') {
      await requestNotificationPermission();
      return;
    }

    setTesting(true);
    try {
      const notification = new Notification('EriSync Test Notification', {
        body: 'This is a test notification from your schedule manager.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'test-notification',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      toast({
        title: "Test Sent",
        description: "Check for the desktop notification!",
      });
    } catch (error) {
      console.error('Error showing test notification:', error);
      toast({
        title: "Error",
        description: "Failed to show test notification.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getPermissionBadge = () => {
    switch (notificationPermission) {
      case 'granted':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Allowed</Badge>;
      case 'denied':
        return <Badge variant="destructive"><BellOff className="w-3 h-3 mr-1" />Blocked</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Not Set</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Manage how you receive notifications about schedule changes and updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Desktop Notification Permission */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications even when the browser is minimized
              </p>
            </div>
            {getPermissionBadge()}
          </div>
          
          {notificationPermission === 'denied' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Notifications are blocked. To enable them, click the lock icon in your browser's address bar and allow notifications for this site.
              </AlertDescription>
            </Alert>
          )}
          
          {notificationPermission === 'default' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Enable desktop notifications to receive alerts about schedule changes even when you're not actively using the app.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex gap-2">
            {notificationPermission !== 'granted' && (
              <Button onClick={requestNotificationPermission} variant="outline" size="sm">
                Enable Desktop Notifications
              </Button>
            )}
            {notificationPermission === 'granted' && (
              <Button 
                onClick={testDesktopNotification} 
                variant="outline" 
                size="sm"
                disabled={testing}
              >
                {testing ? 'Sending...' : 'Test Notification'}
              </Button>
            )}
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="space-y-4">
          <h4 className="font-medium">Notification Types</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>In-App Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Show notifications within the application interface
                </p>
              </div>
              <Switch
                checked={preferences.inAppNotifications}
                onCheckedChange={(checked) =>
                  savePreferences({ ...preferences, inAppNotifications: checked })
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Desktop Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Show system notifications outside the browser
                </p>
              </div>
              <Switch
                checked={preferences.desktopNotifications && notificationPermission === 'granted'}
                disabled={notificationPermission !== 'granted'}
                onCheckedChange={(checked) =>
                  savePreferences({ ...preferences, desktopNotifications: checked })
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Schedule Changes</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when your schedule is modified
                </p>
              </div>
              <Switch
                checked={preferences.scheduleChanges}
                onCheckedChange={(checked) =>
                  savePreferences({ ...preferences, scheduleChanges: checked })
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Weekly Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Receive weekly schedule summaries
                </p>
              </div>
              <Switch
                checked={preferences.weeklyReminders}
                onCheckedChange={(checked) =>
                  savePreferences({ ...preferences, weeklyReminders: checked })
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Team Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Notify about team schedule changes and announcements
                </p>
              </div>
              <Switch
                checked={preferences.teamUpdates}
                onCheckedChange={(checked) =>
                  savePreferences({ ...preferences, teamUpdates: checked })
                }
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;