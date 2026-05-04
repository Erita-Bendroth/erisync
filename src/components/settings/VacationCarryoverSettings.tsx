import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserTimeStats } from "@/hooks/useUserTimeStats";
import { useToast } from "@/hooks/use-toast";

export const VacationCarryoverSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const year = new Date().getFullYear();
  const userIds = user ? [user.id] : [];
  const { stats, loading, updateCarryover } = useUserTimeStats({ userIds, year, enabled: !!user });

  const myStats = user ? stats.get(user.id) : undefined;
  const carryover = myStats?.vacation_days_carryover ?? 0;
  const allowance = myStats?.vacation_days_allowance ?? 0;
  const used = myStats?.vacation_days_used ?? 0;
  const remaining = myStats?.vacation_days_remaining ?? 0;
  const total = allowance + carryover;

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(carryover);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(carryover);
  }, [carryover]);

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      await updateCarryover(user.id, value);
      toast({ title: "Saved", description: "Your vacation carryover was updated." });
      setOpen(false);
    } catch (e) {
      toast({ title: "Error", description: "Could not update carryover.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" />
          Vacation Carryover
        </CardTitle>
        <CardDescription>
          Record any vacation days you carried over from {year - 1}. Carried days are added on top of your {year} allowance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !myStats ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={`${year} allowance`} value={`${allowance}`} suffix="days" />
              <Stat label="Carried over" value={`${carryover}`} suffix="days" highlight />
              <Stat label="Used" value={`${used}`} suffix="days" />
              <Stat label="Remaining" value={`${remaining}`} suffix={`/ ${total}`} />
            </div>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Edit carryover
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vacation carryover for {year}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="carryover-days">Days carried over from {year - 1}</Label>
            <Input
              id="carryover-days"
              type="number"
              min={0}
              max={60}
              value={value}
              onChange={(e) => setValue(Math.max(0, parseInt(e.target.value) || 0))}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              These days are added to your {year} allowance ({allowance} days).
              Maximum 60 days.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const Stat: React.FC<{ label: string; value: string; suffix?: string; highlight?: boolean }> = ({
  label,
  value,
  suffix,
  highlight,
}) => (
  <div className="rounded-md border p-3 bg-muted/30">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-lg font-semibold ${highlight ? "text-blue-600 dark:text-blue-400" : ""}`}>
      {value} {suffix && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}
    </div>
  </div>
);

export default VacationCarryoverSettings;