import React, { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Team {
  id: string;
  name: string;
}

interface Props {
  team: Team | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted: () => void;
}

interface ImpactCounts {
  members: number;
  scheduleEntries: number;
  rosterAssignments: number;
  rosterApprovals: number;
  childTeams: number;
}

export const DeleteTeamDialog: React.FC<Props> = ({ team, open, onOpenChange, onDeleted }) => {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<ImpactCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);

  useEffect(() => {
    if (!open || !team) {
      setConfirmText("");
      setError(null);
      setCounts(null);
      return;
    }
    const loadCounts = async () => {
      setLoadingCounts(true);
      try {
        const [members, sched, rosterAssign, rosterApprov, children] = await Promise.all([
          supabase.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", team.id),
          supabase.from("schedule_entries").select("id", { count: "exact", head: true }).eq("team_id", team.id),
          supabase.from("roster_week_assignments").select("id", { count: "exact", head: true }).eq("team_id", team.id),
          supabase.from("roster_manager_approvals").select("id", { count: "exact", head: true }).eq("team_id", team.id),
          supabase.from("teams").select("id", { count: "exact", head: true }).eq("parent_team_id", team.id),
        ]);
        setCounts({
          members: members.count ?? 0,
          scheduleEntries: sched.count ?? 0,
          rosterAssignments: rosterAssign.count ?? 0,
          rosterApprovals: rosterApprov.count ?? 0,
          childTeams: children.count ?? 0,
        });
      } catch (e) {
        console.error("Failed to load impact counts:", e);
      } finally {
        setLoadingCounts(false);
      }
    };
    loadCounts();
  }, [open, team]);

  if (!team) return null;

  const nameMatches = confirmText.trim() === team.name;
  const hasBlockingRosterData = (counts?.rosterAssignments ?? 0) > 0 || (counts?.rosterApprovals ?? 0) > 0;

  const handleDelete = async () => {
    setError(null);
    if (!nameMatches) {
      setError("Type the team name exactly to confirm.");
      return;
    }
    try {
      setDeleting(true);
      const { error: delError } = await supabase.from("teams").delete().eq("id", team.id);
      if (delError) {
        if (delError.code === "23503") {
          setError(
            "This team has roster data attached (week assignments or approvals) that prevents deletion. Remove the related rosters first, then try again."
          );
        } else {
          setError(delError.message || "Failed to delete the team.");
        }
        return;
      }
      toast({ title: "Team deleted", description: `"${team.name}" was deleted.` });
      onOpenChange(false);
      onDeleted();
    } catch (e: any) {
      console.error("Delete team failed:", e);
      setError(e?.message || "Failed to delete the team.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete team "{team.name}"?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action is permanent and cannot be undone. The following data will be removed for
            this team:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border p-3 text-sm bg-muted/30">
            {loadingCounts ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculating impact…
              </div>
            ) : counts ? (
              <ul className="space-y-1">
                <li>• {counts.members} team member assignment(s)</li>
                <li>• {counts.scheduleEntries} schedule entrie(s)</li>
                <li>• {counts.childTeams} child team(s) (also deleted)</li>
                <li>• Hotline config, capacity config, shift definitions, audit logs, vacation requests, swap requests</li>
                {hasBlockingRosterData && (
                  <li className="text-destructive">
                    • {counts.rosterAssignments} roster assignment(s) and {counts.rosterApprovals} roster approval(s) — these will block deletion
                  </li>
                )}
              </ul>
            ) : (
              <span className="text-muted-foreground">Unable to load impact details.</span>
            )}
          </div>

          {hasBlockingRosterData && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This team is referenced by partnership rosters. Remove or reassign the related rosters before deleting.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-team-name">
              Type <span className="font-mono font-semibold">{team.name}</span> to confirm
            </Label>
            <Input
              id="confirm-team-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={team.name}
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting || !nameMatches}
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete team
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteTeamDialog;