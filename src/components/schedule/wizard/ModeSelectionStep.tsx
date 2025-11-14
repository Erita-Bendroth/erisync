import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, User, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { WizardData } from "./BulkScheduleWizard";

interface ModeSelectionStepProps {
  wizardData: WizardData;
  updateWizardData: (updates: Partial<WizardData>) => void;
}

export const ModeSelectionStep = ({ wizardData, updateWizardData }: ModeSelectionStepProps) => {
  const modes = [
    {
      id: "users",
      title: "Assign to Multiple Users",
      description: "Assign the same shifts to specific team members",
      icon: User,
      recommended: true,
    },
    {
      id: "team",
      title: "Assign to Entire Team",
      description: "Assign the same shifts to all members of a team",
      icon: Users,
    },
    {
      id: "rotation",
      title: "Rotation Schedule",
      description: "Create a rotating schedule with advanced patterns",
      icon: Repeat,
      advanced: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">What would you like to create?</h2>
        <p className="text-muted-foreground">Choose the type of schedule you want to generate</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = wizardData.mode === mode.id;

          return (
            <Card
              key={mode.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg relative",
                isSelected
                  ? "ring-2 ring-primary bg-primary/5"
                  : "hover:bg-accent"
              )}
              onClick={() => updateWizardData({ mode: mode.id as any })}
            >
              {mode.recommended && (
                <div className="absolute -top-2 -right-2">
                  <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full">
                    Popular
                  </span>
                </div>
              )}
              {mode.advanced && (
                <div className="absolute -top-2 -right-2">
                  <span className="bg-accent text-accent-foreground text-xs font-medium px-2 py-1 rounded-full border">
                    Advanced
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <div className={cn(
                  "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center transition-colors",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Icon className="w-8 h-8" />
                </div>
                <CardTitle className="text-lg">{mode.title}</CardTitle>
                <CardDescription className="text-sm">
                  {mode.description}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Tip:</strong> Most users choose "Assign to Multiple Users" as it provides the best balance of flexibility and simplicity.
        </p>
      </div>
    </div>
  );
};
