import React, { useEffect, useMemo, useState } from "react";
import { format, addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useUpsertSubstituteAssignment,
  useDeleteSubstituteAssignment,
  useSubstituteAssignments,
} from "@/hooks/useSubstituteAssignments";

const REASONS = ["Vacation", "Sick", "Training", "Out of office", "Public holiday", "Other"];

interface TeamMemberOption {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

export interface SubstituteAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill team. Required (the dialog needs a team to scope candidates). */
  teamId: string;
  /** Pre-fill the absent person. If omitted, manager picks. */
  absentUserId?: string;
  /** Pre-fill date(s). If a range, the same substitute is applied per day. */
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export const SubstituteAssignmentDialog: React.FC<SubstituteAssignmentDialogProps> = ({
  open,
  onOpenChange,
  teamId,
  absentUserId: initialAbsentUserId,
  startDate: initialStart,
  endDate: initialEnd,
}) => {
  const { toast } = useToast();
  const upsert = useUpsertSubstituteAssignment();
  const remove = useDeleteSubstituteAssignment();

  const today = format(new Date(), "yyyy-MM-dd");
  const [absentUserId, setAbsentUserId] = useState(initialAbsentUserId ?? "");
  const [substituteUserId, setSubstituteUserId] = useState("");
  const [startDate, setStartDate] = useState<string>(initialStart ?? today);
  const [endDate, setEndDate] = useState<string>(initialEnd ?? initialStart ?? today);
  const [reason, setReason] = useState<string>("Vacation");
  const [reasonOther, setReasonOther] = useState("");
  const [notes, setNotes] = useState("");
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [candidates, setCandidates] = useState<TeamMemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setAbsentUserId(initialAbsentUserId ?? "");
      setSubstituteUserId("");
      setStartDate(initialStart ?? today);
      setEndDate(initialEnd ?? initialStart ?? today);
      setReason("Vacation");
      setReasonOther("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAbsentUserId, initialStart, initialEnd]);

  // Load team members for picker
  useEffect(() => {
    if (!open || !teamId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_team_members_safe", { _team_id: teamId });
      if (cancelled) return;
      if (error) {
        toast({ title: "Could not load team members", description: error.message, variant: "destructive" });
      } else {
        setMembers((data ?? []) as TeamMemberOption[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, teamId, toast]);

  // Load substitute candidates (union of all teams the absent person belongs to)
  useEffect(() => {
    if (!open || !absentUserId) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setLoadingCandidates(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_substitute_candidates", {
        _absent_user_id: absentUserId,
      });
      if (cancelled) return;
      if (error) {
        toast({ title: "Could not load substitute candidates", description: error.message, variant: "destructive" });
        setCandidates([]);
      } else {
        setCandidates((data ?? []) as TeamMemberOption[]);
      }
      setLoadingCandidates(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, absentUserId, toast]);

  // Existing assignments in the chosen range, so we can show overrides
  const { data: existing = [] } = useSubstituteAssignments({
    teamIds: teamId ? [teamId] : [],
    startDate,
    endDate,
    enabled: open && !!teamId,
  });

  const dateList = useMemo(() => {
    if (!startDate || !endDate) return [] as string[];
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    const diff = differenceInCalendarDays(e, s);
    if (diff < 0) return [];
    return Array.from({ length: diff + 1 }, (_, i) => format(addDays(s, i), "yyyy-MM-dd"));
  }, [startDate, endDate]);

  const candidateMembers = candidates.filter((m) => m.user_id !== absentUserId);

  const handleSave = async () => {
    if (!teamId || !absentUserId || !substituteUserId) {
      toast({ title: "Missing fields", description: "Pick the absent person and a substitute.", variant: "destructive" });
      return;
    }
    if (absentUserId === substituteUserId) {
      toast({ title: "Invalid choice", description: "Substitute must be a different person.", variant: "destructive" });
      return;
    }
    if (dateList.length === 0) {
      toast({ title: "Invalid date range", variant: "destructive" });
      return;
    }

    const finalReason = reason === "Other" ? reasonOther.trim() || null : reason;

    try {
      for (const date of dateList) {
        await upsert.mutateAsync({
          date,
          team_id: teamId,
          absent_user_id: absentUserId,
          substitute_user_id: substituteUserId,
          reason: finalReason,
          notes: notes.trim() || null,
        });
      }
      toast({
        title: "Substitute assigned",
        description: dateList.length === 1
          ? `Coverage saved for ${dateList[0]}.`
          : `Coverage saved for ${dateList.length} days.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    }
  };

  const handleClearExisting = async () => {
    if (existing.length === 0 || !absentUserId) return;
    const toDelete = existing.filter((e) => e.absent_user_id === absentUserId);
    if (toDelete.length === 0) return;
    try {
      for (const e of toDelete) await remove.mutateAsync(e.id);
      toast({ title: "Cleared", description: `Removed ${toDelete.length} substitute assignment(s).` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign substitute</DialogTitle>
          <DialogDescription>
            Nominate someone to cover for an absent team member. The reason is visible only to managers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Absent person</Label>
            <Select value={absentUserId} onValueChange={setAbsentUserId} disabled={loading}>
              <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.first_name} {m.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {startDate ? format(parseISO(startDate), "MMM d, yyyy") : "Pick"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(startDate)}
                    onSelect={(d) => {
                      if (d) {
                        const s = format(d, "yyyy-MM-dd");
                        setStartDate(s);
                        if (parseISO(endDate) < d) setEndDate(s);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {endDate ? format(parseISO(endDate), "MMM d, yyyy") : "Pick"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(endDate)}
                    onSelect={(d) => {
                      if (d) setEndDate(format(d, "yyyy-MM-dd"));
                    }}
                    disabled={(d) => d < parseISO(startDate)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason (manager-only)</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {reason === "Other" && (
              <Input
                placeholder="Enter reason"
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Substitute</Label>
            <Select value={substituteUserId} onValueChange={setSubstituteUserId} disabled={!absentUserId || loadingCandidates}>
              <SelectTrigger><SelectValue placeholder="Select substitute" /></SelectTrigger>
              <SelectContent>
                {candidateMembers.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.first_name} {m.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingCandidates ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading candidates…
              </div>
            ) : absentUserId ? (
              <p className="text-xs text-muted-foreground">
                Showing {candidateMembers.length} candidate{candidateMembers.length === 1 ? "" : "s"} across the absentee's teams.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Notes (manager-only)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note"
              rows={2}
            />
          </div>

          {existing.filter((e) => e.absent_user_id === absentUserId).length > 0 && (
            <p className="text-xs text-muted-foreground">
              {existing.filter((e) => e.absent_user_id === absentUserId).length} existing assignment(s) in this range will be overwritten.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {existing.filter((e) => e.absent_user_id === absentUserId).length > 0 && (
            <Button variant="ghost" onClick={handleClearExisting} disabled={remove.isPending}>
              Clear existing
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};