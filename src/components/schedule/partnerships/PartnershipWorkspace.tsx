import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hammer, ShieldCheck, CheckSquare, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RosterBuilderDialog } from "./RosterBuilderDialog";
import { RosterValidationPanel } from "./RosterValidationPanel";
import { RosterApprovalPanel } from "./RosterApprovalPanel";
import { RosterActivityLog } from "./RosterActivityLog";

interface PartnershipWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnershipId: string;
  partnershipName: string;
  rosterId: string | null;
  rosterName?: string;
  cycleLength?: number;
  onSuccess?: () => void;
}

/**
 * Unified workspace that consolidates the four roster sub-flows
 * (Build · Validate · Approve · History) into one tabbed surface.
 *
 * Each tab simply mounts the existing focused component, so all
 * downstream business logic and side-effects remain unchanged.
 */
export function PartnershipWorkspace({
  open,
  onOpenChange,
  partnershipId,
  partnershipName,
  rosterId,
  rosterName,
  cycleLength = 4,
  onSuccess,
}: PartnershipWorkspaceProps) {
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: partnership } = await supabase
        .from("team_planning_partners")
        .select("team_ids")
        .eq("id", partnershipId)
        .single();
      if (!partnership?.team_ids) return;
      const { data: teamData } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", partnership.team_ids);
      if (!cancelled) setTeams(teamData ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, partnershipId]);

  // For "build" we keep the existing dialog as its own surface — when the
  // workspace is opened without a roster, jump straight to the builder.
  const buildOnly = !rosterId;

  if (buildOnly) {
    return (
      <RosterBuilderDialog
        partnershipId={partnershipId}
        partnershipName={partnershipName}
        roster={null}
        open={open}
        onOpenChange={onOpenChange}
        onSuccess={() => {
          onSuccess?.();
          onOpenChange(false);
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rosterName ?? "Roster"} — {partnershipName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="build" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="build">
              <Hammer className="w-4 h-4 mr-2" /> Build
            </TabsTrigger>
            <TabsTrigger value="validate">
              <ShieldCheck className="w-4 h-4 mr-2" /> Validate
            </TabsTrigger>
            <TabsTrigger value="approve">
              <CheckSquare className="w-4 h-4 mr-2" /> Approve
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="build" className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Open the full roster builder to edit week assignments.
            </p>
            <BuildLauncher
              partnershipId={partnershipId}
              partnershipName={partnershipName}
              rosterId={rosterId}
              onSuccess={onSuccess}
            />
          </TabsContent>

          <TabsContent value="validate" className="mt-4">
            <RosterValidationPanel
              rosterId={rosterId}
              partnershipId={partnershipId}
              cycleLength={cycleLength}
            />
          </TabsContent>

          <TabsContent value="approve" className="mt-4">
            <RosterApprovalPanel
              rosterId={rosterId}
              teams={teams}
              onRosterActivated={onSuccess}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <RosterActivityLog rosterId={rosterId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function BuildLauncher({
  partnershipId,
  partnershipName,
  rosterId,
  onSuccess,
}: {
  partnershipId: string;
  partnershipName: string;
  rosterId: string;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("partnership_rotation_rosters")
        .select("*")
        .eq("id", rosterId)
        .single();
      setRoster(data);
    })();
  }, [rosterId]);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 text-sm"
        onClick={() => setOpen(true)}
      >
        Open Roster Builder
      </button>
      {open && roster && (
        <RosterBuilderDialog
          partnershipId={partnershipId}
          partnershipName={partnershipName}
          roster={roster}
          open={open}
          onOpenChange={setOpen}
          onSuccess={() => {
            onSuccess?.();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
