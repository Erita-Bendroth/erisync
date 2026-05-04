import React from "react";
import { ArrowRight, UserCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SubstituteBadgeProps {
  /** Initials of the substitute (e.g. "JD") */
  substituteInitials: string;
  /** Full name of the substitute, for tooltip */
  substituteName: string;
  /** Full name of the absent person, for tooltip */
  absentName?: string;
  /** Reason — only passed in when the viewer is a manager/admin/planner */
  reason?: string | null;
  /** Notes — only passed in when the viewer is a manager/admin/planner */
  notes?: string | null;
  /** Variant: 'absence' shown on the absent person's cell, 'covering' on the substitute's cell */
  variant?: "absence" | "covering";
  className?: string;
}

/**
 * Audience-aware badge. The caller decides whether to pass `reason`/`notes`
 * (only managers/admins/planners should). The badge itself never reveals
 * private info that wasn't passed in.
 */
export const SubstituteBadge: React.FC<SubstituteBadgeProps> = ({
  substituteInitials,
  substituteName,
  absentName,
  reason,
  notes,
  variant = "absence",
  className,
}) => {
  const isCovering = variant === "covering";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[10px] font-medium leading-none",
              "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
              className
            )}
          >
            {isCovering ? (
              <UserCheck className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <ArrowRight className="h-2.5 w-2.5" aria-hidden />
            )}
            <span>{substituteInitials}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {isCovering ? (
            <div>
              Covering {absentName ? `for ${absentName}` : ""}
            </div>
          ) : (
            <div>Covered by {substituteName}</div>
          )}
          {reason && <div className="text-muted-foreground">{reason}</div>}
          {notes && <div className="text-muted-foreground italic">{notes}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};