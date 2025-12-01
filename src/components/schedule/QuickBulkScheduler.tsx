import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Sparkles, Loader2, Phone, Trash2 } from "lucide-react";
import { useBulkSchedulerState } from "@/hooks/useBulkSchedulerState";
import { QuickPresetButtons } from "./bulk-scheduler/QuickPresetButtons";
import { TeamPeopleSelector } from "./bulk-scheduler/TeamPeopleSelector";
import { DateRangeQuickPicker } from "./bulk-scheduler/DateRangeQuickPicker";
import { ShiftTypeSelector } from "./bulk-scheduler/ShiftTypeSelector";
import { AdvancedOptionsPanel } from "./bulk-scheduler/AdvancedOptionsPanel";
import { BulkGenerationPreview } from "./bulk-scheduler/BulkGenerationPreview";
import { HotlineQuickPanel } from "./bulk-scheduler/HotlineQuickPanel";
import { BulkDeleteScheduler } from "./BulkDeleteScheduler";
import { calculateBulkEntries } from "@/lib/bulkSchedulerUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useHotlineScheduler } from "@/hooks/useHotlineScheduler";

interface QuickBulkSchedulerProps {
  userId: string | undefined;
  onScheduleGenerated?: () => void;
}

export const QuickBulkScheduler = ({ userId, onScheduleGenerated }: QuickBulkSchedulerProps) => {
  const { config, setConfig, validation, preview } = useBulkSchedulerState(userId);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teamHasHotlineConfig, setTeamHasHotlineConfig] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ 
    user_id: string; 
    country_code?: string; 
    region_code?: string | null 
  }>>([]);
  const { toast } = useToast();
  const { generateHotlineSchedule, saveDrafts, generateAndSaveHotlineForTeam } = useHotlineScheduler();

  // Check if selected team has hotline configuration
  useEffect(() => {
    const checkHotlineConfig = async () => {
      if (!config.teamId) {
        setTeamHasHotlineConfig(false);
        return;
      }
      
      const { data } = await supabase
        .from('hotline_team_config')
        .select('team_id')
        .eq('team_id', config.teamId)
        .single();
      
      setTeamHasHotlineConfig(!!data);
      
      // Reset includeHotline if team doesn't have config
      if (!data && config.includeHotline) {
        setConfig(prev => ({ ...prev, includeHotline: false }));
      }
    };
    
    checkHotlineConfig();
  }, [config.teamId]);

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

  const handleHotlineGenerate = async (teamIds: string[], startDate: Date, endDate: Date) => {
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
      const drafts = await generateHotlineSchedule(teamIds, startDate, endDate);
      
      if (drafts.length === 0) {
        toast({
          title: "No assignments generated",
          description: "Check team configuration and date range",
          variant: "destructive",
        });
        return;
      }

      await saveDrafts(drafts, userId);

      toast({
        title: "✨ Hotline schedule generated!",
        description: `${drafts.length} assignments created in draft. Review in the Step-by-Step Wizard.`,
      });

      onScheduleGenerated?.();
    } catch (error: any) {
      console.error('Error generating hotline schedule:', error);
      toast({
        title: "Generation failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
      // Validate that the selected shift exists (if not custom)
      if (config.shiftType && config.shiftType !== 'custom') {
        const { data: shiftExists } = await supabase
          .from('shift_time_definitions')
          .select('id')
          .eq('id', config.shiftType)
          .maybeSingle();
        
        if (!shiftExists) {
          toast({
            title: "Invalid Shift Type",
            description: "The selected shift type no longer exists. Please select a different shift type.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Fetch team members if needed (with country codes)
      let members = teamMembers;
      if (config.mode === 'team' && config.teamId) {
        const { data } = await supabase
          .from('team_members')
          .select('user_id, profiles!inner(country_code, region_code)')
          .eq('team_id', config.teamId);
        
        if (data) {
          members = data.map(tm => ({
            user_id: tm.user_id,
            country_code: (tm.profiles as any)?.country_code || 'US',
            region_code: (tm.profiles as any)?.region_code
          }));
          setTeamMembers(members);
        }
      }

      // Calculate entries
      const entries = await calculateBulkEntries(config, members, userId, supabase);

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

          // Generate hotline if checkbox is checked
          let hotlineCount = 0;
          if (config.includeHotline && config.teamId) {
            hotlineCount = await generateAndSaveHotlineForTeam(
              config.teamId,
              config.dateRange.start,
              config.dateRange.end,
              userId
            );
          }

          toast({
            title: "✨ Schedule created!",
            description: hotlineCount > 0 
              ? `${filteredEntries.length} shifts + ${hotlineCount} hotline assignments (${entries.length - filteredEntries.length} skipped due to conflicts)`
              : `${filteredEntries.length} shifts added (${entries.length - filteredEntries.length} skipped due to conflicts)`,
          });
        } else {
          // No conflicts, insert all
          const { error } = await supabase
            .from('schedule_entries')
            .insert(entries);

          if (error) throw error;

          // Generate hotline if checkbox is checked
          let hotlineCount = 0;
          if (config.includeHotline && config.teamId) {
            hotlineCount = await generateAndSaveHotlineForTeam(
              config.teamId,
              config.dateRange.start,
              config.dateRange.end,
              userId
            );
          }

          toast({
            title: "✨ Schedule created!",
            description: hotlineCount > 0 
              ? `${entries.length} shifts + ${hotlineCount} hotline assignments`
              : `${entries.length} shifts added successfully`,
          });
        }
      } else {
        // Overwrite mode - delete ALL entries in the full date range (including skipped days like weekends)
        const fullDateRange: string[] = [];
        const current = new Date(config.dateRange.start);
        while (current <= config.dateRange.end) {
          fullDateRange.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
        const userIds = [...new Set(entries.map(e => e.user_id))];
        
        await supabase
          .from('schedule_entries')
          .delete()
          .in('date', fullDateRange)
          .in('user_id', userIds);

        const { error } = await supabase
          .from('schedule_entries')
          .insert(entries);

        if (error) throw error;

        // Auto-generate hotline if team has config
        let hotlineCount = 0;
        if (config.teamId) {
          hotlineCount = await generateAndSaveHotlineForTeam(
            config.teamId,
            config.dateRange.start,
            config.dateRange.end,
            userId
          );
        }

        toast({
          title: "✨ Schedule created!",
          description: hotlineCount > 0 
            ? `${entries.length} shifts + ${hotlineCount} hotline assignments`
            : `${entries.length} shifts added successfully`,
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
          onValueChange={(value: any) => setConfig(prev => ({ ...prev, mode: value }))}
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="users">Selected People</TabsTrigger>
            <TabsTrigger value="team">Entire Team</TabsTrigger>
            <TabsTrigger value="rotation">Rotation</TabsTrigger>
            <TabsTrigger value="hotline" className="gap-2">
              <Phone className="h-4 w-4" />
              Hotline
            </TabsTrigger>
            <TabsTrigger value="delete" className="gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {config.mode === 'delete' ? (
        <BulkDeleteScheduler 
          userId={userId} 
          onDeleted={onScheduleGenerated}
        />
      ) : config.mode === 'hotline' ? (
        <HotlineQuickPanel
          onGenerate={handleHotlineGenerate}
          loading={loading}
        />
      ) : (
        <>
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
                teamId={config.teamId}
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
                excludedDays={config.excludedDays}
                skipHolidays={config.skipHolidays}
                onDateRangeChange={(start, end) =>
                  setConfig({ ...config, dateRange: { start, end } })
                }
                onExcludedDaysChange={(days) =>
                  setConfig({ ...config, excludedDays: days })
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
                teamId={config.teamId}
                autoDetectWeekends={config.autoDetectWeekends}
                autoDetectHolidays={config.autoDetectHolidays}
                weekendShiftOverride={config.weekendShiftOverride}
                selectedUserIds={config.selectedUserIds}
                mode={config.mode}
                excludedDays={config.excludedDays}
              />
            </div>
          </div>

          {teamHasHotlineConfig && (
            <div className="flex items-center space-x-2 p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
              <Checkbox
                id="include-hotline"
                checked={config.includeHotline}
                onCheckedChange={(checked) => 
                  setConfig({ ...config, includeHotline: checked as boolean })
                }
              />
              <Label 
                htmlFor="include-hotline" 
                className="flex items-center gap-2 cursor-pointer text-sm font-medium"
              >
                <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Also generate hotline assignments
              </Label>
            </div>
          )}
        </>
      )}

      {config.mode !== 'hotline' && config.mode !== 'delete' && (
        <>
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full">
                <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                Advanced Options
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <AdvancedOptionsPanel
                config={config}
                onConfigChange={setConfig}
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
        </>
      )}
    </Card>
  );
};
