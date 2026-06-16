import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OpenShiftRequest {
  id: string;
  team_id: string;
  partnership_id: string | null;
  shift_date: string;
  shift_type: string;
  status: "open" | "claimed" | "cancelled";
  claimed_by: string | null;
  created_by: string;
  notes: string | null;
  created_at: string;
}

/**
 * Fetch open coverage requests for the given teams (members see open ones for
 * their teams; managers also see the ones they created). Subscribes to realtime
 * inserts/updates so the panel refreshes when a new one is broadcast or claimed.
 */
export function useOpenShiftRequests(teamIds: string[]) {
  const [requests, setRequests] = useState<OpenShiftRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (teamIds.length === 0) {
      setRequests([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("open_shift_requests")
      .select("*")
      .in("team_id", teamIds)
      .eq("status", "open")
      .order("shift_date", { ascending: true });
    if (!error) setRequests((data || []) as OpenShiftRequest[]);
    setLoading(false);
  }, [teamIds.join(",")]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (teamIds.length === 0) return;
    const channel = supabase
      .channel("open_shift_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "open_shift_requests" },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, teamIds.join(",")]);

  const claim = useCallback(async (id: string) => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return { ok: false, error: "Not signed in" };
    const { data, error } = await supabase
      .from("open_shift_requests")
      .update({ status: "claimed", claimed_by: uid })
      .eq("id", id)
      .eq("status", "open")
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: "Already claimed" };
    await refetch();
    return { ok: true };
  }, [refetch]);

  const cancel = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("open_shift_requests")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (!error) await refetch();
    return { ok: !error, error: error?.message };
  }, [refetch]);

  return { requests, loading, refetch, claim, cancel };
}