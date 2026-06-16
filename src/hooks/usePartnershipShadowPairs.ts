import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ShadowPair {
  id: string;
  partnership_id: string;
  lead_user_id: string;
  shadow_user_id: string;
  applies_to: string[];
  active: boolean;
  notes: string | null;
}

export function usePartnershipShadowPairs(partnershipId: string | null) {
  const [pairs, setPairs] = useState<ShadowPair[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!partnershipId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("partnership_shadow_pairs" as any)
      .select("*")
      .eq("partnership_id", partnershipId)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast({ title: "Failed to load shadow pairs", description: error.message, variant: "destructive" });
      return;
    }
    setPairs((data as unknown as ShadowPair[]) || []);
  }, [partnershipId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const addPair = useCallback(
    async (lead_user_id: string, shadow_user_id: string, applies_to: string[] = ["E", "L", "N"]) => {
      if (!partnershipId) return;
      if (lead_user_id === shadow_user_id) {
        toast({ title: "Lead and shadow must be different members", variant: "destructive" });
        return;
      }
      const { error } = await supabase
        .from("partnership_shadow_pairs" as any)
        .insert({ partnership_id: partnershipId, lead_user_id, shadow_user_id, applies_to, active: true });
      if (error) {
        toast({ title: "Could not add pair", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    },
    [partnershipId, toast, load],
  );

  const updatePair = useCallback(
    async (id: string, patch: Partial<Pick<ShadowPair, "applies_to" | "active" | "notes">>) => {
      const { error } = await supabase
        .from("partnership_shadow_pairs" as any)
        .update(patch)
        .eq("id", id);
      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    },
    [toast, load],
  );

  const deletePair = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("partnership_shadow_pairs" as any)
        .delete()
        .eq("id", id);
      if (error) {
        toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    },
    [toast, load],
  );

  return { pairs, loading, reload: load, addPair, updatePair, deletePair };
}
