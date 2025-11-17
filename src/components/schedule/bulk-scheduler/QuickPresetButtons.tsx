import { Button } from "@/components/ui/button";
import { Calendar, Users, RotateCw } from "lucide-react";
import { getThisWeek, getNextWeek, getThisMonth } from "@/lib/bulkSchedulerUtils";
import { BulkSchedulerConfig } from "@/hooks/useBulkSchedulerState";

interface QuickPresetButtonsProps {
  onApplyPreset: (config: Partial<BulkSchedulerConfig>) => void;
}

export const QuickPresetButtons = ({ onApplyPreset }: QuickPresetButtonsProps) => {
  const presets = [
    {
      id: 'thisWeek',
      label: 'This Week',
      icon: Calendar,
      config: {
        dateRange: getThisWeek(),
        mode: 'users' as const,
      }
    },
    {
      id: 'nextWeek',
      label: 'Next Week',
      icon: Calendar,
      config: {
        dateRange: getNextWeek(),
        mode: 'users' as const,
      }
    },
    {
      id: 'thisMonth',
      label: 'This Month',
      icon: Calendar,
      config: {
        dateRange: getThisMonth(),
        mode: 'users' as const,
      }
    },
    {
      id: 'entireTeam',
      label: 'Entire Team',
      icon: Users,
      config: {
        mode: 'team' as const,
      }
    },
    {
      id: 'rotation',
      label: 'Rotation',
      icon: RotateCw,
      config: {
        mode: 'rotation' as const,
      }
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="w-full text-sm font-medium text-muted-foreground mb-1">
        Quick Presets
      </div>
      {presets.map((preset) => {
        const Icon = preset.icon;
        return (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => onApplyPreset(preset.config)}
            className="gap-2"
          >
            <Icon className="h-4 w-4" />
            {preset.label}
          </Button>
        );
      })}
    </div>
  );
};
