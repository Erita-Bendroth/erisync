import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Calendar, Sun, Moon, Briefcase, Settings } from 'lucide-react';
import { UserTimeStats } from '@/hooks/useUserTimeStats';
import { useToast } from '@/hooks/use-toast';

interface Props {
  stats: UserTimeStats;
  canEdit: boolean;
  onUpdate: (vacationDays: number, flextimeHours: number) => Promise<void>;
}

export const UserTimeStatsDisplay: React.FC<Props> = ({ stats, canEdit, onUpdate }) => {
  const [editOpen, setEditOpen] = useState(false);
  const [vacationDays, setVacationDays] = useState(stats.vacation_days_allowance);
  const [flextimeHours, setFlextimeHours] = useState(stats.flextime_hours_allowance);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      setSaving(true);
      await onUpdate(vacationDays, flextimeHours);
      toast({
        title: "Success",
        description: "Time allowances updated successfully",
      });
      setEditOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update allowances",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Vacation Days */}
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground">Vacation Days</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-medium">
                {stats.vacation_days_remaining}/{stats.vacation_days_allowance}
              </span>
              {stats.is_override && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  Custom
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {stats.vacation_days_used} used
            </span>
          </div>
        </div>

        {/* Flextime Hours */}
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-purple-500 mt-1 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground">Flextime Hours</span>
            <span className="text-sm font-medium">
              {stats.flextime_hours_remaining.toFixed(1)}/{stats.flextime_hours_allowance}
            </span>
            <span className="text-xs text-muted-foreground">
              {stats.flextime_hours_used.toFixed(1)} used
            </span>
          </div>
        </div>

        {/* Total Hours Worked */}
        <div className="flex items-start gap-2">
          <Briefcase className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground">Hours Worked</span>
            <span className="text-sm font-medium">
              {stats.total_hours_worked.toFixed(1)} hrs
            </span>
            <span className="text-xs text-muted-foreground">
              {stats.total_shifts} shifts
            </span>
          </div>
        </div>

        {/* Weekend & Holiday Shifts */}
        <div className="flex items-start gap-2">
          <Sun className="h-4 w-4 text-orange-500 mt-1 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground">Weekend/Holiday</span>
            <span className="text-sm font-medium">
              {stats.weekend_shifts}W / {stats.holiday_shifts}H
            </span>
            <span className="text-xs text-muted-foreground">
              special shifts
            </span>
          </div>
        </div>

        {/* Night Shifts */}
        <div className="flex items-start gap-2">
          <Moon className="h-4 w-4 text-indigo-500 mt-1 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground">Night Shifts</span>
            <span className="text-sm font-medium">{stats.night_shifts}</span>
            <span className="text-xs text-muted-foreground">
              late/early
            </span>
          </div>
        </div>
      </div>

      {canEdit && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full mt-2">
              <Settings className="h-4 w-4 mr-2" />
              Edit Allowances
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Time Allowances for {stats.year}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="vacation-days">Vacation Days (per year)</Label>
                <Input
                  id="vacation-days"
                  type="number"
                  value={vacationDays}
                  onChange={(e) => setVacationDays(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  max={365}
                />
                <p className="text-xs text-muted-foreground">
                  Default: 30 days. Current used: {stats.vacation_days_used} days.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="flextime-hours">Flextime Hours (per year)</Label>
                <Input
                  id="flextime-hours"
                  type="number"
                  value={flextimeHours}
                  onChange={(e) => setFlextimeHours(Math.max(0, parseFloat(e.target.value) || 0))}
                  min={0}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">
                  Default: 0 hours. Current used: {stats.flextime_hours_used.toFixed(1)} hours.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
