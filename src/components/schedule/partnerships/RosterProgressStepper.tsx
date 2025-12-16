import { Check, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStep {
  label: string;
  description?: string;
  status: "complete" | "current" | "upcoming";
}

interface RosterProgressStepperProps {
  rosterName: string;
  rosterId: string | null;
  status: string;
  myTeamProgress: {
    total: number;
    completed: number;
  };
  allTeamsProgress: {
    total: number;
    completed: number;
  };
}

export function RosterProgressStepper({
  rosterName,
  rosterId,
  status,
  myTeamProgress,
  allTeamsProgress,
}: RosterProgressStepperProps) {
  const getSteps = (): ProgressStep[] => {
    const hasName = rosterName.trim().length > 0;
    const hasSaved = !!rosterId;
    const myTeamDone = myTeamProgress.completed >= myTeamProgress.total && myTeamProgress.total > 0;
    const allTeamsDone = allTeamsProgress.completed >= allTeamsProgress.total && allTeamsProgress.total > 0;
    const isPendingApproval = status === "pending_approval";
    const isApproved = status === "approved";
    const isImplemented = status === "implemented";

    return [
      {
        label: "Name your roster",
        description: hasName ? `"${rosterName}"` : "Enter a roster name",
        status: hasName ? "complete" : "current",
      },
      {
        label: "Assign your team's shifts",
        description: myTeamProgress.total > 0 
          ? `${myTeamProgress.completed} of ${myTeamProgress.total} people assigned`
          : "Save roster first",
        status: !hasSaved 
          ? "upcoming" 
          : myTeamDone 
            ? "complete" 
            : hasName ? "current" : "upcoming",
      },
      {
        label: "Submit for approval",
        description: isPendingApproval || isApproved || isImplemented
          ? "Submitted"
          : allTeamsDone 
            ? "Ready to submit"
            : "Waiting for all teams",
        status: isPendingApproval || isApproved || isImplemented
          ? "complete"
          : allTeamsDone && myTeamDone
            ? "current"
            : "upcoming",
      },
      {
        label: "Roster activated",
        description: isImplemented
          ? "Schedule created"
          : isApproved
            ? "Ready to activate"
            : "Pending approvals",
        status: isImplemented
          ? "complete"
          : isApproved
            ? "current"
            : "upcoming",
      },
    ];
  };

  const steps = getSteps();

  return (
    <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg p-4 border">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold">Your Progress</span>
        <span className="text-xs text-muted-foreground">
          ({steps.filter(s => s.status === "complete").length} of {steps.length} steps)
        </span>
      </div>
      
      <div className="flex flex-col gap-1">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start gap-3">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                  step.status === "complete" && "bg-green-500 text-white",
                  step.status === "current" && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                  step.status === "upcoming" && "bg-muted text-muted-foreground border"
                )}
              >
                {step.status === "complete" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : step.status === "current" ? (
                  <ArrowRight className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              {index < steps.length - 1 && (
                <div 
                  className={cn(
                    "w-0.5 h-4 my-1",
                    step.status === "complete" ? "bg-green-500" : "bg-border"
                  )}
                />
              )}
            </div>
            
            {/* Step content */}
            <div className="flex-1 pb-2">
              <div
                className={cn(
                  "text-sm font-medium",
                  step.status === "complete" && "text-green-700 dark:text-green-400",
                  step.status === "current" && "text-foreground",
                  step.status === "upcoming" && "text-muted-foreground"
                )}
              >
                {step.label}
              </div>
              {step.description && (
                <div className="text-xs text-muted-foreground">
                  {step.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
