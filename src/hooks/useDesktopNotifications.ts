import { useState, useEffect } from 'react';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  silent?: boolean;
}

export const useDesktopNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      throw new Error('Notifications are not supported in this browser');
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  const showNotification = (options: NotificationOptions): Notification | null => {
    if (!isSupported) {
      console.warn('Notifications are not supported in this browser');
      return null;
    }

    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    // Check if user has enabled desktop notifications in preferences
    const prefs = localStorage.getItem('notificationPreferences');
    if (prefs) {
      try {
        const preferences = JSON.parse(prefs);
        if (!preferences.desktopNotifications) {
          console.log('Desktop notifications disabled by user preference');
          return null;
        }
      } catch (error) {
        console.error('Error parsing notification preferences:', error);
      }
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag,
        silent: options.silent || false,
      });

      // Auto-close after 5 seconds if not manually closed
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Focus window when notification is clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  };

  const showScheduleChangeNotification = (details: {
    employeeName: string;
    date: string;
    changeType: string;
  }) => {
    return showNotification({
      title: 'Schedule Updated',
      body: `${details.employeeName}'s schedule has been ${details.changeType} for ${details.date}`,
      tag: 'schedule-change',
    });
  };

  const showWeeklyReminderNotification = () => {
    return showNotification({
      title: 'Weekly Schedule Reminder',
      body: 'Your weekly schedule summary is ready. Check your upcoming shifts and assignments.',
      tag: 'weekly-reminder',
    });
  };

  const showTeamUpdateNotification = (teamName: string, updateType: string) => {
    return showNotification({
      title: 'Team Update',
      body: `${teamName} has ${updateType}. Check the latest team information.`,
      tag: 'team-update',
    });
  };

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    showScheduleChangeNotification,
    showWeeklyReminderNotification,
    showTeamUpdateNotification,
  };
};

export default useDesktopNotifications;