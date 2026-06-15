import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Sparkles } from "lucide-react";
import { usePartnershipShiftCodes } from "@/hooks/usePartnershipShiftCodes";
import { ShiftCode } from "@/lib/offshorePattern";
import { useToast } from "@/hooks/use-toast";

interface Props {
  partnershipId: string;
}

export function OffshorePatternPanel({ partnershipId }: Props) {
  const { codes, seedPreset, saveCode, deleteCode } = usePartnershipShiftCodes(partnershipId);
  const { toast } = useToast();
  const [offshore, setOffshore] = useState<boolean>(false);
  const [editing, setEditing] = useState<Partial<ShiftCode> | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase
        .from("team_planning_partners")
        .select("team_ids")
        .eq("id", partnershipId)
        .single();
      if (!p?.team_ids?.length) return;
      const { data: t } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", p.team_ids);
      if (!cancelled) setTeams(t ?? []);
    })();
    return () => { cancelled = true; };
  }, [partnershipId]);

  // Load offshore mode flag from the most recent draft roster (or default false)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("partnership_rotation_rosters")
        .select("offshore_mode")
        .eq("partnership_id", partnershipId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setOffshore(!!data?.offshore_mode);
    })();
  }, [partnershipId]);

  const toggleOffshore = async (next: boolean) => {
    setOffshore(next);
    // Apply to all draft rosters of this partnership
    await supabase
      .from("partnership_rotation_rosters")
      .update({ offshore_mode: next })
      .eq("partnership_id", partnershipId)
      .in("status", ["draft", "pending_approval"]);

    if (next && codes.length === 0) {
      await seedPreset();
    }
    toast({ title: next ? "Offshore mode enabled" : "Offshore mode disabled" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offshore shift pattern</CardTitle>
          <CardDescription>
            Enable continuous day-by-day rosters with mandatory recovery (WO) days.
            Each shift code defines how many WO days are required before/after.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="offshore-toggle" className="text-sm font-medium">
                Offshore mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Switches the roster builder from week-grid to a day-by-day pattern with auto-generated WO days.
              </p>
            </div>
            <Switch id="offshore-toggle" checked={offshore} onCheckedChange={toggleOffshore} />
          </div>

          {codes.length === 0 && (
            <Button variant="outline" size="sm" onClick={seedPreset}>
              <Sparkles className="w-4 h-4 mr-2" /> Load offshore preset (E/L/N/D/WO)
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Shift code library</CardTitle>
          <Button size="sm" onClick={() => setEditing({ code: "", label: "", color: "#94a3b8", is_working: true, recovery_rule: {} })}>
            <Plus className="w-4 h-4 mr-1" /> Add code
          </Button>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No codes yet. Load the preset or add one manually.</p>
          ) : (
            <div className="space-y-2">
              {codes.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded border">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.code}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.label}</div>
                    <div className="text-xs text-muted-foreground flex gap-2 items-center flex-wrap">
                      {c.is_working ? <Badge variant="outline">Working</Badge> : <Badge variant="secondary">Non-working</Badge>}
                      {c.recovery_rule?.before ? <span>{c.recovery_rule.before} WO before</span> : null}
                      {c.recovery_rule?.after ? <span>{c.recovery_rule.after} WO after</span> : null}
                      {c.recovery_rule?.longBlockAfter && c.recovery_rule?.longBlockThreshold ? (
                        <span>
                          {c.recovery_rule.longBlockAfter} WO after if block ≥ {c.recovery_rule.longBlockThreshold}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteCode(c.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <ShiftCodeEditor
          value={editing}
          onCancel={() => setEditing(null)}
          onSave={async (v) => {
            await saveCode(v);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ShiftCodeEditor({
  value,
  onSave,
  onCancel,
}: {
  value: Partial<ShiftCode>;
  onSave: (v: Partial<ShiftCode>) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<Partial<ShiftCode>>(value);
  const r = v.recovery_rule || {};
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{v.id ? "Edit code" : "New code"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Code</Label>
            <Input value={v.code ?? ""} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="e.g. N" />
          </div>
          <div>
            <Label>Label</Label>
            <Input value={v.label ?? ""} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder="Night" />
          </div>
          <div>
            <Label>Color</Label>
            <Input type="color" value={v.color ?? "#94a3b8"} onChange={(e) => setV({ ...v, color: e.target.value })} />
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={v.is_working ?? true} onCheckedChange={(b) => setV({ ...v, is_working: b })} />
            <Label>Working shift</Label>
          </div>
        </div>
        {v.is_working && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <Label>WO days before</Label>
              <Input
                type="number"
                min={0}
                value={r.before ?? 0}
                onChange={(e) => setV({ ...v, recovery_rule: { ...r, before: +e.target.value || 0 } })}
              />
            </div>
            <div>
              <Label>WO days after</Label>
              <Input
                type="number"
                min={0}
                value={r.after ?? 0}
                onChange={(e) => setV({ ...v, recovery_rule: { ...r, after: +e.target.value || 0 } })}
              />
            </div>
            <div>
              <Label>WO after (long block)</Label>
              <Input
                type="number"
                min={0}
                value={r.longBlockAfter ?? 0}
                onChange={(e) => setV({ ...v, recovery_rule: { ...r, longBlockAfter: +e.target.value || 0 } })}
              />
            </div>
            <div>
              <Label>Long block threshold (consecutive shifts)</Label>
              <Input
                type="number"
                min={0}
                value={r.longBlockThreshold ?? 0}
                onChange={(e) => setV({ ...v, recovery_rule: { ...r, longBlockThreshold: +e.target.value || 0 } })}
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSave(v)} disabled={!v.code || !v.label}>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}