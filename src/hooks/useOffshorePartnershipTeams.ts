import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the subset of teamIds that belong to an offshore-mode partnership.
 * For these teams, the Team Availability view shows actual E/L/N shift codes.
 */
export function useOffshorePartnershipTeams(teamIds: string[]) {
  const [offshoreTeamIds, setOffshoreTeamIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (teamIds.length === 0) {
        setOffshoreTeamIds([]);
        return;
      }
      const { data: parts } = await supabase
        .from("team_planning_partners")
        .select("id, team_ids");
      if (cancelled || !parts) return;
      const offshoreIds = new Set<string>();
      const partsTouching = parts.filter((p: any) =>
        Array.isArray(p.team_ids) && p.team_ids.some((t: string) => teamIds.includes(t)),
      );
      if (partsTouching.length === 0) {
        setOffshoreTeamIds([]);
        return;
      }
      const { data: rosters } = await supabase
        .from("partnership_rotation_rosters")
        .select("partnership_id, offshore_mode")
        .in("partnership_id", partsTouching.map((p: any) => p.id))
        .eq("offshore_mode", true);
      if (cancelled) return;
      const offshorePartIds = new Set((rosters || []).map((r: any) => r.partnership_id));
      partsTouching.forEach((p: any) => {
        if (offshorePartIds.has(p.id)) {
          p.team_ids.forEach((t: string) => offshoreIds.add(t));
        }
      });
      setOffshoreTeamIds(Array.from(offshoreIds));
    })();
    return () => {
      cancelled = true;
    };
  }, [teamIds.join(",")]);

  return offshoreTeamIds;
}