import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OFFSHORE_PRESET, ShiftCode, RecoveryRule } from "@/lib/offshorePattern";
import { useToast } from "@/hooks/use-toast";

export function usePartnershipShiftCodes(partnershipId: string | null) {
  const [codes, setCodes] = useState<ShiftCode[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!partnershipId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("partnership_shift_codes")
      .select("*")
      .eq("partnership_id", partnershipId)
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) {
      toast({ title: "Failed to load shift codes", description: error.message, variant: "destructive" });
      return;
    }
    setCodes(
      (data || []).map((d: any) => ({
        ...d,
        recovery_rule: (d.recovery_rule || {}) as RecoveryRule,
      })),
    );
  }, [partnershipId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const seedPreset = useCallback(async () => {
    if (!partnershipId) return;
    const rows = OFFSHORE_PRESET.map((c) => ({
      ...c,
      partnership_id: partnershipId,
      recovery_rule: c.recovery_rule as any,
    }));
    const { error } = await supabase
      .from("partnership_shift_codes")
      .insert(rows);
    if (error) {
      toast({ title: "Could not seed preset", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Offshore preset added" });
      await load();
    }
  }, [partnershipId, toast, load]);

  const saveCode = useCallback(
    async (code: Partial<ShiftCode> & { id?: string }) => {
      if (!partnershipId) return;
      if (code.id) {
        const { error } = await supabase
          .from("partnership_shift_codes")
          .update({
            code: code.code,
            label: code.label,
            color: code.color,
            is_working: code.is_working,
            shift_type: code.shift_type,
            recovery_rule: code.recovery_rule as any,
            sort_order: code.sort_order,
          })
          .eq("id", code.id);
        if (error) {
          toast({ title: "Save failed", description: error.message, variant: "destructive" });
          return;
        }
      } else {
        const { error } = await supabase.from("partnership_shift_codes").insert({
          partnership_id: partnershipId,
          code: code.code!,
          label: code.label!,
          color: code.color ?? "#94a3b8",
          is_working: code.is_working ?? true,
          shift_type: code.shift_type ?? null,
          recovery_rule: (code.recovery_rule ?? {}) as any,
          sort_order: code.sort_order ?? codes.length,
        });
        if (error) {
          toast({ title: "Create failed", description: error.message, variant: "destructive" });
          return;
        }
      }
      await load();
    },
    [partnershipId, codes.length, toast, load],
  );

  const deleteCode = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("partnership_shift_codes").delete().eq("id", id);
      if (error) {
        toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    },
    [toast, load],
  );

  return { codes, loading, reload: load, seedPreset, saveCode, deleteCode };
}