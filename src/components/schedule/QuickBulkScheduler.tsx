import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { useBulkSchedulerState } from "@/hooks/useBulkSchedulerState";
import { QuickPresetButtons } from "./bulk-scheduler/QuickPresetButtons";
import { TeamPeopleSelector } from "./bulk-scheduler/TeamPeopleSelector";
import { DateRangeQuickPicker } from "./bulk-scheduler/DateRangeQuickPicker";
import { ShiftTypeSelector } from "./bulk-scheduler/ShiftTypeSelector";
import { AdvancedOptionsPanel } from "./bulk-scheduler/AdvancedOptionsPanel";
import { BulkGenerationPreview } from "./bulk-scheduler/BulkGenerationPreview";
import { calculateBulkEntries } from "@/lib/bulkSchedulerUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QuickBulkSchedulerProps {
  userId: string | undefined;
  onScheduleGenerated?: () => void;
}

export const QuickBulkScheduler = ({ userId, onScheduleGenerated }: QuickBulkSchedulerProps) => {
  const { config, setConfig, validation, preview } = useBulkSchedulerState(userId);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ user_id: string }>>([]);
  const { toast } = useToast();

  const handleApplyPreset = (presetConfig: any) => {
    setConfig(prev => ({
      ...prev,
      ...presetConfig,
      advanced: presetConfig.advanced
        ? { ...prev.advanced, ...presetConfig.advanced }
        : prev.advanced,
    }));

    toast({
      title: "Preset applied",
      description: "Configuration updated with preset values",
    });
  };

  const handleGenerate = async () => {
    if (!validation.isValid) {
      toast({
        title: "Cannot generate",
        description: validation.errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Fetch team members if needed
      let members = teamMembers;
      if (config.mode === 'team' && config.teamId) {
        const { data } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', config.teamId);
        
        if (data) {
          members = data;
          setTeamMembers(data);
        }
      }

      // Calculate entries
      const entries = calculateBulkEntries(config, members, userId);

      if (entries.length === 0) {
        toast({
          title: "No entries to create",
          description: "Check your configuration",
          variant: "destructive",
        });
        return;
      }

      // Check for conflicts if needed
      if (config.advanced.conflictHandling === 'skip') {
        // Query existing entries
        const dates = [...new Set(entries.map(e => e.date))];
        const userIds = [...new Set(entries.map(e => e.user_id))];
        
        const { data: existingEntries } = await supabase
          .from('schedule_entries')
          .select('date, user_id')
          .in('date', dates)
          .in('user_id', userIds);

        if (existingEntries && existingEntries.length > 0) {
          // Filter out conflicts
          const conflictSet = new Set(
            existingEntries.map(e => `${e.user_id}:${e.date}`)
          );
          
          const filteredEntries = entries.filter(
            e => !conflictSet.has(`${e.user_id}:${e.date}`)
          );

          if (filteredEntries.length === 0) {
            toast({
              title: "All entries already exist",
              description: "No new entries to create",
            });
            setLoading(false);
            return;
          }

          // Use filtered entries
          const { error } = await supabase
            .from('schedule_entries')
            .insert(filteredEntries);

          if (error) throw error;

          toast({
            title: "✨ Schedule created!",
            description: `${filteredEntries.length} shifts added (${entries.length - filteredEntries.length} skipped due to conflicts)`,
          });
        } else {
          // No conflicts, insert all
          const { error } = await supabase
            .from('schedule_entries')
            .insert(entries);

          if (error) throw error;

          toast({
            title: "✨ Schedule created!",
            description: `${entries.length} shifts added successfully`,
          });
        }
      } else {
        // Overwrite mode - delete existing and insert new
        const dates = [...new Set(entries.map(e => e.date))];
        const userIds = [...new Set(entries.map(e => e.user_id))];
        
        await supabase
          .from('schedule_entries')
          .delete()
          .in('date', dates)
          .in('user_id', userIds);

        const { error } = await supabase
          .from('schedule_entries')
          .insert(entries);

        if (error) throw error;

        toast({
          title: "✨ Schedule created!",
          description: `${entries.length} shifts added successfully`,
        });
      }

      onScheduleGenerated?.();
    } catch (error: any) {
      console.error('Error generating schedule:', error);
      toast({
        title: "Generation failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">🚀 Quick Bulk Scheduler</h2>
      </div>

      <QuickPresetButtons onApplyPreset={handleApplyPreset} />

      <div className="space-y-4">
        <Tabs
          value={config.mode}
          onValueChange={(value: any) => setConfig({ ...config, mode: value })}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Selected People</TabsTrigger>
            <TabsTrigger value="team">Entire Team</TabsTrigger>
            <TabsTrigger value="rotation">Rotation</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <TeamPeopleSelector
            teamId={config.teamId}
            selectedUserIds={config.selectedUserIds}
            onTeamChange={(teamId) => setConfig({ ...config, teamId })}
            onUserSelectionChange={(userIds) =>
              setConfig({ ...config, selectedUserIds: userIds })
            }
            mode={config.mode}
          />

          <ShiftTypeSelector
            shiftType={config.shiftType}
            customTimes={config.customTimes}
            onShiftTypeChange={(type) => setConfig({ ...config, shiftType: type })}
            onCustomTimesChange={(times) =>
              setConfig({ ...config, customTimes: times })
            }
          />
        </div>

        <div className="space-y-6">
          <DateRangeQuickPicker
            startDate={config.dateRange.start}
            endDate={config.dateRange.end}
            skipWeekends={config.skipWeekends}
            skipHolidays={config.skipHolidays}
            onDateRangeChange={(start, end) =>
              setConfig({ ...config, dateRange: { start, end } })
            }
            onSkipWeekendsChange={(skip) =>
              setConfig({ ...config, skipWeekends: skip })
            }
            onSkipHolidaysChange={(skip) =>
              setConfig({ ...config, skipHolidays: skip })
            }
          />

          <BulkGenerationPreview
            totalShifts={preview.totalShifts}
            workDays={preview.workDays}
            userCount={preview.userCount}
            startDate={config.dateRange.start}
            endDate={config.dateRange.end}
            shiftType={config.shiftType}
          />
        </div>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full">
            <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            Advanced Options
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <AdvancedOptionsPanel
            advanced={config.advanced}
            onAdvancedChange={(advanced) => setConfig({ ...config, advanced })}
          />
        </CollapsibleContent>
      </Collapsible>

      {!validation.isValid && (
        <div className="text-sm text-destructive space-y-1">
          {validation.errors.map((error, i) => (
            <div key={i}>⚠️ {error}</div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={!validation.isValid || loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate Schedule
        </Button>
      </div>
    </Card>
  );
};
