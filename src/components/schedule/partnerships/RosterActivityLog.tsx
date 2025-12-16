import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, History, UserPlus, UserMinus, Copy, Trash2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  target_user_id: string | null;
  target_team_id: string | null;
  week_number: number | null;
  day_of_week: number | null;
  old_value: string | null;
  new_value: string | null;
  details: any;
  created_at: string;
  // Joined data
  user_name: string;
  user_initials: string;
  target_user_name: string | null;
  team_name: string | null;
}

interface RosterActivityLogProps {
  rosterId: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  assigned: <UserPlus className="h-4 w-4 text-green-600" />,
  removed: <UserMinus className="h-4 w-4 text-red-600" />,
  changed: <RefreshCw className="h-4 w-4 text-blue-600" />,
  cleared: <Trash2 className="h-4 w-4 text-orange-600" />,
  copied: <Copy className="h-4 w-4 text-purple-600" />,
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RosterActivityLog({ rosterId }: RosterActivityLogProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`roster-activity-${rosterId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "roster_activity_log",
          filter: `roster_id=eq.${rosterId}`,
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rosterId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("roster_activity_log")
        .select("*")
        .eq("roster_id", rosterId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set([
        ...data.map(a => a.user_id),
        ...data.filter(a => a.target_user_id).map(a => a.target_user_id),
      ])];

      // Get unique team IDs
      const teamIds = [...new Set(data.filter(a => a.target_team_id).map(a => a.target_team_id))];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, initials")
        .in("user_id", userIds);

      // Fetch teams
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", teamIds);

      const profileMap: Record<string, any> = {};
      profiles?.forEach(p => {
        profileMap[p.user_id] = p;
      });

      const teamMap: Record<string, string> = {};
      teams?.forEach(t => {
        teamMap[t.id] = t.name;
      });

      const enrichedActivities = data.map(activity => {
        const actor = profileMap[activity.user_id];
        const target = activity.target_user_id ? profileMap[activity.target_user_id] : null;
        
        return {
          ...activity,
          user_name: actor ? `${actor.first_name} ${actor.last_name}` : "Unknown",
          user_initials: actor?.initials || "?",
          target_user_name: target ? `${target.first_name} ${target.last_name}` : null,
          team_name: activity.target_team_id ? teamMap[activity.target_team_id] : null,
        };
      });

      setActivities(enrichedActivities);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionDescription = (activity: ActivityLog) => {
    const week = activity.week_number ? `Week ${activity.week_number}` : "";
    const day = activity.day_of_week !== null ? DAY_NAMES[activity.day_of_week] : "";
    const location = [week, day].filter(Boolean).join(" ");

    switch (activity.action) {
      case "assigned":
        return (
          <>
            assigned <strong>{activity.target_user_name}</strong> to{" "}
            <Badge variant="secondary" className="text-xs mx-1">{activity.new_value}</Badge>
            {location && <span className="text-muted-foreground">({location})</span>}
          </>
        );
      case "removed":
        return (
          <>
            removed <strong>{activity.target_user_name}</strong> from {location}
          </>
        );
      case "changed":
        return (
          <>
            changed <strong>{activity.target_user_name}</strong> from{" "}
            <Badge variant="outline" className="text-xs mx-1">{activity.old_value}</Badge>
            to{" "}
            <Badge variant="secondary" className="text-xs mx-1">{activity.new_value}</Badge>
            {location && <span className="text-muted-foreground">({location})</span>}
          </>
        );
      case "cleared":
        const count = activity.details?.count || "all";
        return (
          <>
            cleared <strong>{count} assignments</strong> for {activity.team_name || "their team"}
          </>
        );
      case "copied":
        const toWeeks = activity.details?.to_weeks || "all weeks";
        return (
          <>
            copied Week 1 to <strong>{toWeeks}</strong>
          </>
        );
      default:
        return activity.action;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center">
        <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          No activity yet. Changes to the roster will appear here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="h-4 w-4" />
        <span>Recent changes to this roster</span>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10">
                  {activity.user_initials}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {ACTION_ICONS[activity.action] || <History className="h-4 w-4" />}
                  <span className="font-medium">{activity.user_name}</span>
                  {activity.team_name && (
                    <Badge variant="outline" className="text-xs">
                      {activity.team_name}
                    </Badge>
                  )}
                </div>
                <p className="text-sm mt-1">
                  {getActionDescription(activity)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}