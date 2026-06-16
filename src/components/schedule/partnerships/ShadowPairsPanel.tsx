import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, UserPlus, Users } from "lucide-react";
import { usePartnershipShadowPairs } from "@/hooks/usePartnershipShadowPairs";

interface Member {
  user_id: string;
  display_name: string;
}

const ALL_CODES = ["E", "L", "N"] as const;

export function ShadowPairsPanel({ partnershipId }: { partnershipId: string }) {
  const { pairs, addPair, updatePair, deletePair } = usePartnershipShadowPairs(partnershipId);
  const [members, setMembers] = useState<Member[]>([]);
  const [leadId, setLeadId] = useState<string>("");
  const [shadowId, setShadowId] = useState<string>("");
  const [appliesTo, setAppliesTo] = useState<string[]>(["E", "L", "N"]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_partnership_team_members", {
        p_partnership_id: partnershipId,
      });
      const unique = new Map<string, Member>();
      (data || []).forEach((r: any) => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
        unique.set(r.user_id, { user_id: r.user_id, display_name: name || r.initials || "User" });
      });
      setMembers(Array.from(unique.values()).sort((a, b) => a.display_name.localeCompare(b.display_name)));
    })();
  }, [partnershipId]);

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.display_name ?? id.slice(0, 8);

  const toggleCode = (code: string) => {
    setAppliesTo((cur) =>
      cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code].sort(),
    );
  };

  const handleAdd = async () => {
    if (!leadId || !shadowId || appliesTo.length === 0) return;
    await addPair(leadId, shadowId, appliesTo);
    setLeadId("");
    setShadowId("");
    setAppliesTo(["E", "L", "N"]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" />
          Shadow pairs (buddy / trainee rotation)
        </CardTitle>
        <CardDescription>
          When a lead member gets an E/L/N duty week, the shadow is automatically
          assigned to the same shift. Used for trainee buddies that always work alongside a senior.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing pairs */}
        {pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shadow pairs configured yet.</p>
        ) : (
          <div className="space-y-2">
            {pairs.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-2 rounded border flex-wrap"
              >
                <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                  <span className="font-medium truncate">{nameOf(p.lead_user_id)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium truncate">{nameOf(p.shadow_user_id)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {ALL_CODES.map((c) => {
                    const on = p.applies_to.includes(c);
                    return (
                      <Badge
                        key={c}
                        variant={on ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const next = on
                            ? p.applies_to.filter((x) => x !== c)
                            : [...p.applies_to, c].sort();
                          updatePair(p.id, { applies_to: next });
                        }}
                      >
                        {c}
                      </Badge>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={p.active}
                    onCheckedChange={(b) => updatePair(p.id, { active: b })}
                  />
                  <span className="text-xs text-muted-foreground">
                    {p.active ? "Active" : "Paused"}
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deletePair(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new pair */}
        <div className="grid gap-3 p-3 border-2 border-dashed rounded">
          <div className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add shadow pair
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Lead (duty owner)</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick lead…" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Shadow (mirrors the lead)</Label>
              <Select value={shadowId} onValueChange={setShadowId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick shadow…" />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter((m) => m.user_id !== leadId)
                    .map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.display_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Mirror on shift codes</Label>
            <div className="flex gap-2 mt-1">
              {ALL_CODES.map((c) => (
                <Badge
                  key={c}
                  variant={appliesTo.includes(c) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleCode(c)}
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!leadId || !shadowId || appliesTo.length === 0}
            >
              <Plus className="w-4 h-4 mr-1" /> Add pair
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
