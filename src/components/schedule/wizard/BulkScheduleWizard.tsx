import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { eachDayOfInterval, format } from "date-fns";
import { ModeSelectionStep } from "./ModeSelectionStep";
import { TeamPeopleStep } from "./TeamPeopleStep";
import { DateRangeStep } from "./DateRangeStep";
import { ShiftConfigStep } from "./ShiftConfigStep";
import { ShiftPatternStep } from "./ShiftPatternStep";
import { AdvancedOptionsStep } from "./AdvancedOptionsStep";
import { ReviewStep } from "./ReviewStep";
import { WizardProgress } from "./WizardProgress";

export interface WizardData {
  mode: "team" | "users" | "rotation";
  selectedTeam: string;
  selectedUsers: string[];
  startDate?: Date;
  endDate?: Date;
  skipWeekends: boolean;
  skipHolidays: boolean;
  shiftType: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  fairnessMode: boolean;
  fairnessWeight: number;
  historicalWindow: number;
  avoidConsecutiveWeekends: boolean;
  balanceHolidayShifts: boolean;
  enableRecurring: boolean;
  rotationIntervalWeeks: number;
  rotationCycles: number;
  perDateTimes?: { [dateStr: string]: { startTime: string; endTime: string } };
  shiftPattern?: {
    [dateStr: string]: {
      shiftType: string;
      shiftName: string;
      startTime: string;
      endTime: string;
      isDayOff?: boolean;
    }
  };
}

interface BulkScheduleWizardProps {
  onScheduleGenerated?: () => void;
  onCancel?: () => void;
}

export const BulkScheduleWizard = ({ onScheduleGenerated, onCancel }: BulkScheduleWizardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(false);

  const [wizardData, setWizardData] = useState<WizardData>({
    mode: "users",
    selectedTeam: "",
    selectedUsers: [],
    skipWeekends: true,
    skipHolidays: true,
    shiftType: "custom",
    shiftName: "Day Shift",
    startTime: "08:00",
    endTime: "16:30",
    fairnessMode: false,
    fairnessWeight: 50,
    historicalWindow: 6,
    avoidConsecutiveWeekends: true,
    balanceHolidayShifts: true,
    enableRecurring: false,
    rotationIntervalWeeks: 4,
    rotationCycles: 1,
    shiftPattern: {},
  });

  useEffect(() => {
    checkPermissions();
  }, [user]);

  const checkPermissions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;

      const roles = data.map(r => r.role);
      const canCreate = roles.includes("admin") || roles.includes("planner");
      setHasPermission(canCreate);

      if (!canCreate) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to use the bulk schedule generator.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  };

  const steps = wizardData.mode === "rotation" 
    ? [
        { id: 0, label: "Mode", component: ModeSelectionStep },
        { id: 1, label: "Team & People", component: TeamPeopleStep },
        { id: 2, label: "Dates", component: DateRangeStep },
        { id: 3, label: "Configure Shifts", component: ShiftPatternStep },
        { id: 4, label: "Options", component: AdvancedOptionsStep },
        { id: 5, label: "Review", component: ReviewStep },
      ]
    : [
        { id: 0, label: "Mode", component: ModeSelectionStep },
        { id: 1, label: "Team & People", component: TeamPeopleStep },
        { id: 2, label: "Dates", component: DateRangeStep },
        { id: 3, label: "Shifts", component: ShiftConfigStep },
        { id: 4, label: "Options", component: AdvancedOptionsStep },
        { id: 5, label: "Review", component: ReviewStep },
      ];

  const canProceed = () => {
    const currentStepInfo = steps[currentStep];
    if (!currentStepInfo) return false;
    
    // Check based on step label instead of index
    switch (currentStepInfo.label) {
      case "Mode":
        return wizardData.mode !== null;
      case "Team & People":
        if (wizardData.mode === "team") {
          return wizardData.selectedTeam !== "";
        }
        return wizardData.selectedTeam !== "" && wizardData.selectedUsers.length > 0;
      case "Dates":
        return wizardData.startDate && wizardData.endDate;
      case "Shifts":
        return wizardData.startTime && wizardData.endTime;
      case "Configure Shifts":
        // For rotation mode, check if all dates in range have shifts configured
        if (!wizardData.shiftPattern || !wizardData.startDate || !wizardData.endDate) return false;
        
        // Use eachDayOfInterval and format() to match ShiftPatternStep's date keys
        const dateRange = eachDayOfInterval({
          start: wizardData.startDate,
          end: wizardData.endDate,
        });
        
        return dateRange.every(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          return wizardData.shiftPattern?.[dateStr];
        });
      case "Options":
        return true; // Always valid, optional settings
      case "Review":
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    // This will be called from ReviewStep
    setLoading(false);
  };

  if (!hasPermission) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            You need admin or planner permissions to access the schedule generator.
          </div>
        </CardContent>
      </Card>
    );
  }

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="space-y-4">
      <WizardProgress steps={steps} currentStep={currentStep} />

      <Card>
        <CardContent className="p-6">
          {currentStep === steps.length - 1 ? (
            <ReviewStep
              wizardData={wizardData}
              onScheduleGenerated={onScheduleGenerated}
            />
          ) : (
            <CurrentStepComponent
              wizardData={wizardData}
              updateWizardData={updateWizardData}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={currentStep === 0 ? onCancel : handleBack}
          disabled={loading}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {currentStep === 0 ? "Cancel" : "Back"}
        </Button>

        {currentStep < steps.length - 1 && (
          <Button
            onClick={handleNext}
            disabled={!canProceed() || loading}
          >
            Continue
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
};
