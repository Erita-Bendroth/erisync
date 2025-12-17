import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Clock } from "lucide-react";

interface FlexTimeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLimit: number;
  currentInitialBalance: number;
  onSave: (newLimit: number, newInitialBalance: number) => Promise<boolean>;
}

export function FlexTimeSettingsDialog({
  open,
  onOpenChange,
  currentLimit,
  currentInitialBalance,
  onSave,
}: FlexTimeSettingsDialogProps) {
  const [limit, setLimit] = useState(currentLimit.toString());
  const [initialHours, setInitialHours] = useState("0");
  const [initialMinutes, setInitialMinutes] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLimit(currentLimit.toString());
      // Convert decimal hours to hours and minutes
      const hours = Math.floor(Math.abs(currentInitialBalance));
      const minutes = Math.round((Math.abs(currentInitialBalance) - hours) * 60);
      const sign = currentInitialBalance < 0 ? "-" : "";
      setInitialHours(sign + hours.toString());
      setInitialMinutes(minutes.toString());
    }
  }, [open, currentLimit, currentInitialBalance]);

  const handleSave = async () => {
    const numericLimit = parseFloat(limit);
    if (isNaN(numericLimit) || numericLimit < 0) {
      return;
    }

    // Convert hours and minutes to decimal
    const hours = parseInt(initialHours) || 0;
    const minutes = parseInt(initialMinutes) || 0;
    const isNegative = initialHours.startsWith("-") || hours < 0;
    const absHours = Math.abs(hours);
    const decimalBalance = (absHours + minutes / 60) * (isNegative ? -1 : 1);

    setSaving(true);
    const success = await onSave(numericLimit, decimalBalance);
    setSaving(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const numericLimit = parseFloat(limit);
  const isLimitValid = !isNaN(numericLimit) && numericLimit >= 0 && numericLimit <= 999;
  
  const hours = parseInt(initialHours) || 0;
  const minutes = parseInt(initialMinutes) || 0;
  const isBalanceValid = !isNaN(hours) && !isNaN(minutes) && minutes >= 0 && minutes < 60;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>FlexTime Settings</DialogTitle>
          <DialogDescription>
            Configure your personal flextime settings based on your work agreement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Initial Balance Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <Label className="text-base font-medium">Starting Balance</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter your already accumulated flex hours from before using this system (one-time setting).
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label htmlFor="initial-hours" className="text-xs text-muted-foreground">Hours</Label>
                <Input
                  id="initial-hours"
                  type="number"
                  min="-999"
                  max="999"
                  value={initialHours}
                  onChange={(e) => setInitialHours(e.target.value)}
                  placeholder="0"
                />
              </div>
              <span className="mt-5 text-lg font-medium">:</span>
              <div className="flex-1">
                <Label htmlFor="initial-minutes" className="text-xs text-muted-foreground">Minutes</Label>
                <Input
                  id="initial-minutes"
                  type="number"
                  min="0"
                  max="59"
                  value={initialMinutes}
                  onChange={(e) => setInitialMinutes(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Example: Enter -5 hours and 30 minutes if you owe 5.5 hours, or 12 hours and 45 minutes if you have 12h 45m accumulated.
            </p>
          </div>

          {/* Carryover Limit Section */}
          <div className="space-y-2">
            <Label htmlFor="carryover-limit">Carryover Limit (hours)</Label>
            <Input
              id="carryover-limit"
              type="number"
              min="0"
              max="999"
              step="0.5"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="40"
            />
            <p className="text-xs text-muted-foreground">
              Maximum flextime hours you can carry over to the next month. Default is 40 hours based on German regulations.
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>German FlexTime Regulations:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Standard carryover limit: 40 hours</li>
                <li>Balance must be settled within 12 months</li>
                <li>Exceeding limits may require HR approval</li>
              </ul>
              <p className="mt-2 text-muted-foreground">
                Check your individual work agreement for your specific limits.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !isLimitValid || !isBalanceValid}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
