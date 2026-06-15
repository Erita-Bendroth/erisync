import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { isOffshoreByTeamNames } from "@/lib/offshorePattern";

interface ShiftRequirement {
  shift_type: string;
  staff_required: number;
  notes: string;
}

interface ShiftRequirementsProps {
  partnershipId: string;
}

const DEFAULT_SHIFT_TYPES = [
  { value: "late", label: "🌙 Late Shift", description: "Evening and night coverage" },
  { value: "early", label: "☀️ Early Shift", description: "Morning coverage" },
  { value: "weekend", label: "📅 Weekend", description: "Saturday and Sunday" },
];

const OFFSHORE_SHIFT_TYPES = [
  { value: "early", label: "☀️ Early Shift", description: "Morning coverage" },
  { value: "late", label: "🌆 Late Shift", description: "Afternoon coverage" },
  { value: "night", label: "🌙 Night Shift", description: "Overnight coverage" },
  { value: "normal", label: "🛠️ Normal Day", description: "Standard working day" },
];

export function ShiftRequirements({ partnershipId }: ShiftRequirementsProps) {
  const [requirements, setRequirements] = useState<Record<string, ShiftRequirement>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOffshore, setIsOffshore] = useState(false);

  const SHIFT_TYPES = isOffshore ? OFFSHORE_SHIFT_TYPES : DEFAULT_SHIFT_TYPES;

  useEffect(() => {
    fetchRequirements();
    detectOffshore();
  }, [partnershipId]);

  const detectOffshore = async () => {
    const { data: p } = await supabase
      .from("team_planning_partners")
      .select("team_ids")
      .eq("id", partnershipId)
      .single();
    if (!p?.team_ids?.length) return;
    const { data: teams } = await supabase
      .from("teams")
      .select("name")
      .in("id", p.team_ids);
    setIsOffshore(isOffshoreByTeamNames((teams ?? []).map((t: any) => t.name)));
  };

  const fetchRequirements = async () => {
    try {
      const { data, error } = await supabase
        .from("partnership_shift_requirements")
        .select("*")
        .eq("partnership_id", partnershipId);

      if (error) throw error;

      const reqMap: Record<string, ShiftRequirement> = {};
      data?.forEach((req) => {
        reqMap[req.shift_type] = {
          shift_type: req.shift_type,
          staff_required: req.staff_required,
          notes: req.notes || "",
        };
      });

      setRequirements(reqMap);
    } catch (error) {
      console.error("Error fetching shift requirements:", error);
      toast.error("Failed to load shift requirements");
    } finally {
      setLoading(false);
    }
  };

  // Ensure defaults exist for the currently-displayed shift type list
  useEffect(() => {
    setRequirements((prev) => {
      const next = { ...prev };
      SHIFT_TYPES.forEach((type) => {
        if (!next[type.value]) {
          next[type.value] = { shift_type: type.value, staff_required: 1, notes: "" };
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffshore, loading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only save the shift types currently displayed for this partnership
      const upsertData = SHIFT_TYPES.map((type) => {
        const req = requirements[type.value];
        return {
          partnership_id: partnershipId,
          shift_type: type.value,
          staff_required: req?.staff_required ?? 1,
          notes: req?.notes || null,
        };
      });

      const { error } = await supabase
        .from("partnership_shift_requirements")
        .upsert(upsertData, {
          onConflict: "partnership_id,shift_type",
        });

      if (error) throw error;

      toast.success("Shift requirements saved");
    } catch (error) {
      console.error("Error saving shift requirements:", error);
      toast.error("Failed to save shift requirements");
    } finally {
      setSaving(false);
    }
  };

  const updateRequirement = (shiftType: string, field: keyof ShiftRequirement, value: any) => {
    setRequirements({
      ...requirements,
      [shiftType]: {
        ...requirements[shiftType],
        [field]: value,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Per-Shift Staffing Requirements</h3>
        <p className="text-sm text-muted-foreground">
          Define how many people are required for each shift type across all teams in this
          partnership
        </p>
      </div>

      <div className="grid gap-4">
        {SHIFT_TYPES.map((type) => {
          const req = requirements[type.value];
          return (
            <Card key={type.value} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{type.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{type.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`${type.value}-staff`} className="text-xs">
                        Minimum Staff Required
                      </Label>
                      <Input
                        id={`${type.value}-staff`}
                        type="number"
                        min="0"
                        value={req?.staff_required || 1}
                        onChange={(e) =>
                          updateRequirement(
                            type.value,
                            "staff_required",
                            parseInt(e.target.value) || 1
                          )
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${type.value}-notes`} className="text-xs">
                        Notes (optional)
                      </Label>
                      <Input
                        id={`${type.value}-notes`}
                        value={req?.notes || ""}
                        onChange={(e) =>
                          updateRequirement(type.value, "notes", e.target.value)
                        }
                        placeholder="e.g., Must include senior engineer"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Requirements
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
