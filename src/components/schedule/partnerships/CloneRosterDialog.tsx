import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";

interface CloneRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceRosterName: string;
  sourceStartDate: string;
  onConfirm: (newName: string, newStartDate: string) => void;
}

export function CloneRosterDialog({
  open,
  onOpenChange,
  sourceRosterName,
  sourceStartDate,
  onConfirm,
}: CloneRosterDialogProps) {
  // Default to one year after original start date
  const defaultNewStartDate = new Date(sourceStartDate);
  defaultNewStartDate.setFullYear(defaultNewStartDate.getFullYear() + 1);
  
  const [newName, setNewName] = useState(`${sourceRosterName} (Copy)`);
  const [newStartDate, setNewStartDate] = useState(
    defaultNewStartDate.toISOString().split('T')[0]
  );

  const handleConfirm = () => {
    if (newName.trim()) {
      onConfirm(newName.trim(), newStartDate);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Clone Rotation Roster</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="clone-name">New Roster Name</Label>
            <Input
              id="clone-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter roster name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clone-start-date">New Start Date</Label>
            <div className="relative">
              <Input
                id="clone-start-date"
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <p className="text-xs text-muted-foreground">
              Original roster starts: {new Date(sourceStartDate).toLocaleDateString()}
            </p>
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">What will be copied:</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• All weekly assignments and team members</li>
              <li>• Cycle length and shift configuration</li>
              <li>• Default shift settings</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              The cloned roster will be created as a <span className="font-medium">draft</span> for you to review and submit for approval.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!newName.trim()}>
            Create Clone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
