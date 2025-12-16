import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Trash2, Wand2, Check, Loader2, ChevronDown, Undo2 } from "lucide-react";

interface RosterQuickActionsProps {
  saveStatus: "idle" | "saving" | "saved" | "error";
  isReadOnly: boolean;
  hasAssignments: boolean;
  onCopyWeekToAll: () => void;
  onFillMyTeamRow: (shiftType: string) => void;
  onClearMyTeam: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

export function RosterQuickActions({
  saveStatus,
  isReadOnly,
  hasAssignments,
  onCopyWeekToAll,
  onFillMyTeamRow,
  onClearMyTeam,
  onUndo,
  canUndo,
}: RosterQuickActionsProps) {
  const getSaveStatusDisplay = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <Badge variant="outline" className="gap-1 bg-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </Badge>
        );
      case "saved":
        return (
          <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
            <Check className="h-3 w-3" />
            All changes saved
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="gap-1">
            Save failed
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isReadOnly) {
    return (
      <div className="flex items-center justify-end">
        <Badge variant="secondary">Read-only</Badge>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Quick Actions:</span>
          
          {/* Copy Week 1 to All */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onCopyWeekToAll}
                disabled={!hasAssignments}
                className="gap-1"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Week 1 → All
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Duplicate Week 1 assignments to all other weeks</p>
            </TooltipContent>
          </Tooltip>

          {/* Fill My Team */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Wand2 className="h-3.5 w-3.5" />
                    Fill My Team
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Quickly assign a shift type to your entire team</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onFillMyTeamRow("normal")}>
                💼 Fill with Normal Shift
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFillMyTeamRow("early")}>
                ☀️ Fill with Early Shift
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFillMyTeamRow("late")}>
                🌙 Fill with Late Shift
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFillMyTeamRow("off")}>
                🏖️ Fill with Off
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear My Team */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onClearMyTeam}
                className="gap-1 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear My Team
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Remove all assignments for your team</p>
            </TooltipContent>
          </Tooltip>

          {/* Undo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                className="gap-1"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo last change</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Save Status */}
        <div className="flex items-center gap-2">
          {getSaveStatusDisplay()}
        </div>
      </div>
    </TooltipProvider>
  );
}
