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
import { Info } from "lucide-react";

interface FlexTimeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLimit: number;
  onSave: (newLimit: number) => Promise<boolean>;
}

export function FlexTimeSettingsDialog({
  open,
  onOpenChange,
  currentLimit,
  onSave,
}: FlexTimeSettingsDialogProps) {
  const [limit, setLimit] = useState(currentLimit.toString());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLimit(currentLimit.toString());
    }
  }, [open, currentLimit]);

  const handleSave = async () => {
    const numericLimit = parseFloat(limit);
    if (isNaN(numericLimit) || numericLimit < 0) {
      return;
    }

    setSaving(true);
    const success = await onSave(numericLimit);
    setSaving(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const numericLimit = parseFloat(limit);
  const isValid = !isNaN(numericLimit) && numericLimit >= 0 && numericLimit <= 999;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>FlexTime Settings</DialogTitle>
          <DialogDescription>
            Configure your personal flextime carryover limit based on your work agreement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
          <Button onClick={handleSave} disabled={saving || !isValid}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
