import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FlexTimeSettingsDialog } from "./FlexTimeSettingsDialog";

interface ManagerFlexTimeOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user whose flextime settings the manager is editing. */
  targetUserId: string | null;
  /** Optional: target user's country code for country-specific copy. */
  targetUserCountryCode?: string | null;
  /** Optional friendly name for toasts/log. */
  targetUserName?: string;
}

/**
 * Manager-mode wrapper around FlexTimeSettingsDialog.
 * Loads the target user's current flextime settings and writes back overrides
 * (bypassing the per-user one-time lock on starting balance).
 * Also recalculates the target user's monthly flextime summaries when the
 * starting balance changes.
 */
export function ManagerFlexTimeOverrideDialog({
  open,
  onOpenChange,
  targetUserId,
  targetUserCountryCode,
  targetUserName,
}: ManagerFlexTimeOverrideDialogProps) {
  const { toast } = useToast();
  const [limit, setLimit] = useState<number>(40);
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !targetUserId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("flextime_carryover_limit, initial_flextime_balance")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (!cancelled) {
        if (error) {
          toast({
            title: "Error",
            description: "Failed to load user's flextime settings",
            variant: "destructive",
          });
        } else if (data) {
          setLimit(Number(data.flextime_carryover_limit ?? 40));
          setInitialBalance(Number(data.initial_flextime_balance ?? 0));
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, targetUserId, toast]);

  const handleSave = async (newLimit: number, newInitialBalance: number): Promise<boolean> => {
    if (!targetUserId) return false;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          flextime_carryover_limit: newLimit,
          initial_flextime_balance: newInitialBalance,
          initial_flextime_balance_set_at: new Date().toISOString(),
        })
        .eq("user_id", targetUserId);
      if (error) throw error;

      // Recalculate monthly summaries for this user, walking from the earliest
      // entry forward. Mirrors the logic in useTimeEntries.recalculateAllMonthlySummaries.
      const { data: allEntries } = await supabase
        .from("daily_time_entries")
        .select("entry_date, flextime_delta")
        .eq("user_id", targetUserId)
        .order("entry_date", { ascending: true });

      if (allEntries && allEntries.length > 0) {
        const monthsSet = new Set<string>();
        allEntries.forEach((e) => {
          monthsSet.add(e.entry_date.slice(0, 7)); // YYYY-MM
        });
        const monthsSorted = Array.from(monthsSet).sort();
        let running = newInitialBalance;
        for (const ym of monthsSorted) {
          const [yStr, mStr] = ym.split("-");
          const year = Number(yStr);
          const month = Number(mStr);
          const monthDelta = allEntries
            .filter((e) => e.entry_date.startsWith(ym))
            .reduce((s, e) => s + (Number(e.flextime_delta) || 0), 0);
          const starting = running;
          const ending = starting + monthDelta;
          await supabase
            .from("monthly_flextime_summary")
            .upsert(
              {
                user_id: targetUserId,
                year,
                month,
                starting_balance: starting,
                month_delta: monthDelta,
                ending_balance: ending,
              },
              { onConflict: "user_id,year,month" }
            );
          running = ending;
        }
      }

      toast({
        title: "Saved",
        description: targetUserName
          ? `FlexTime settings updated for ${targetUserName}`
          : "FlexTime settings updated",
      });
      return true;
    } catch (e) {
      console.error("Manager flextime override failed:", e);
      toast({
        title: "Error",
        description: "Failed to update flextime settings",
        variant: "destructive",
      });
      return false;
    }
  };

  if (!targetUserId) return null;

  return (
    <FlexTimeSettingsDialog
      open={open && !loading}
      onOpenChange={onOpenChange}
      currentLimit={limit}
      currentInitialBalance={initialBalance}
      onSave={handleSave}
      countryCode={targetUserCountryCode}
      mode="manager"
    />
  );
}
