import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useHotlineScheduler } from "@/hooks/useHotlineScheduler";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

interface DraftAssignment {
  id: string;
  team_id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_substitute: boolean;
  original_user_id?: string;
}

interface TeamInfo {
  id: string;
  name: string;
}

interface UserInfo {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface HotlineDraftPreviewProps {
  teamIds: string[];
  onFinalized?: () => void;
}

export const HotlineDraftPreview = ({ teamIds, onFinalized }: HotlineDraftPreviewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { finalizeDrafts, loading: finalizing } = useHotlineScheduler();
  const [drafts, setDrafts] = useState<DraftAssignment[]>([]);
  const [teams, setTeams] = useState<Map<string, TeamInfo>>(new Map());
  const [users, setUsers] = useState<Map<string, UserInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDrafts();
  }, [teamIds]);

  const fetchDrafts = async () => {
    try {
      setLoading(true);

      // Fetch drafts
      const { data: draftsData, error } = await supabase
        .from("hotline_draft_assignments")
        .select("*")
        .in("team_id", teamIds)
        .eq("status", "draft")
        .order("date");

      if (error) throw error;

      setDrafts(draftsData || []);

      // Fetch team info
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", teamIds);

      const teamsMap = new Map<string, TeamInfo>();
      teamsData?.forEach(t => teamsMap.set(t.id, t));
      setTeams(teamsMap);

      // Fetch user info
      const userIds = [...new Set(draftsData?.map(d => d.user_id) || [])];
      if (userIds.length > 0) {
        const { data: usersData } = await supabase.rpc("get_multiple_basic_profile_info", {
          _user_ids: userIds,
        });

        const usersMap = new Map<string, UserInfo>();
        usersData?.forEach(u => usersMap.set(u.user_id, u));
        setUsers(usersMap);
      }
    } catch (error) {
      console.error("Error fetching drafts:", error);
      toast({
        title: "Error",
        description: "Failed to load draft schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!user) return;

    try {
      await finalizeDrafts(teamIds, user.id);
      onFinalized?.();
    } catch (error) {
      console.error("Error finalizing:", error);
    }
  };

  // Calculate statistics
  const stats = {
    totalDays: new Set(drafts.map(d => d.date)).size,
    totalAssignments: drafts.length,
    substitutions: drafts.filter(d => d.is_substitute).length,
  };

  // Group by date
  const draftsByDate = drafts.reduce((acc, draft) => {
    if (!acc[draft.date]) acc[draft.date] = [];
    acc[draft.date].push(draft);
    return acc;
  }, {} as Record<string, DraftAssignment[]>);

  // Calculate fairness per team
  const fairnessPerTeam = teamIds.map(teamId => {
    const teamDrafts = drafts.filter(d => d.team_id === teamId);
    const countPerUser = new Map<string, number>();
    
    teamDrafts.forEach(d => {
      countPerUser.set(d.user_id, (countPerUser.get(d.user_id) || 0) + 1);
    });

    const counts = Array.from(countPerUser.values());
    const avg = counts.reduce((sum, c) => sum + c, 0) / (counts.length || 1);
    const max = Math.max(...counts, 0);
    const min = Math.min(...counts, Infinity);

    return {
      teamId,
      teamName: teams.get(teamId)?.name || teamId,
      avg: avg.toFixed(1),
      distribution: Array.from(countPerUser.entries())
        .map(([userId, count]) => ({
          user: users.get(userId),
          count,
        }))
        .sort((a, b) => b.count - a.count),
    };
  });

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading preview...</div>
    );
  }

  if (drafts.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No draft assignments found. Please generate a schedule first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Review Hotline Schedule</h2>
        <p className="text-muted-foreground">
          Review and finalize the hotline assignments
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDays}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Substitutions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.substitutions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Fairness Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Fairness Distribution</CardTitle>
          <CardDescription>Assignment counts per team member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fairnessPerTeam.map(team => (
            <div key={team.teamId} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{team.teamName}</span>
                <Badge variant="secondary">Avg: {team.avg} shifts</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {team.distribution.map(({ user, count }) => (
                  <Badge key={user?.user_id} variant="outline">
                    {user?.initials}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Schedule Table */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Preview</CardTitle>
          <CardDescription>Daily hotline assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {teamIds.map(teamId => (
                    <TableHead key={teamId}>{teams.get(teamId)?.name}</TableHead>
                  ))}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(draftsByDate).map(([date, assignments]) => (
                  <TableRow key={date}>
                    <TableCell className="font-medium">
                      {format(new Date(date), "EEE MMM dd, yyyy")}
                    </TableCell>
                    {teamIds.map(teamId => {
                      const teamAssignments = assignments.filter(a => a.team_id === teamId);
                      return (
                        <TableCell key={teamId}>
                          {teamAssignments.map((a, idx) => {
                            const user = users.get(a.user_id);
                            return (
                              <div key={idx} className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                <span>
                                  {user?.initials} ({a.start_time}-{a.end_time})
                                </span>
                                {a.is_substitute && (
                                  <Badge variant="outline" className="ml-1 text-xs">
                                    Sub
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      {assignments.some(a => a.is_substitute) ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => window.history.back()} disabled={finalizing}>
          Back to Edit
        </Button>
        <Button onClick={handleFinalize} disabled={finalizing}>
          {finalizing ? "Finalizing..." : "Finalize & Save Schedule"}
        </Button>
      </div>
    </div>
  );
};
