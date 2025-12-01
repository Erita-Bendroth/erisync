import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { eachDayOfInterval, getDay, format } from "date-fns";

interface EligibleMember {
  user_id: string;
  first_name: string;
  last_name: string;
  last_hotline_date?: Date;
}

interface HotlineConfig {
  team_id: string;
  min_staff_required: number;
  weekday_start_time: string;
  weekday_end_time: string;
  friday_start_time: string;
  friday_end_time: string;
}

interface DraftAssignment {
  team_id: string;
  user_id: string;
  date: Date;
  start_time: string;
  end_time: string;
  is_substitute: boolean;
  original_user_id?: string;
}

export const useHotlineScheduler = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const fetchEligibleMembers = async (teamId: string): Promise<EligibleMember[]> => {
    const { data: eligible, error } = await supabase
      .from("hotline_eligible_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("is_active", true);

    if (error) throw error;

    if (!eligible || eligible.length === 0) return [];

    // Get profile info
    const { data: profiles } = await supabase
      .rpc("get_multiple_basic_profile_info", {
        _user_ids: eligible.map(e => e.user_id),
      });

    // Get last hotline assignment for each member
    const { data: lastAssignments } = await supabase
      .from("duty_assignments")
      .select("user_id, date")
      .eq("team_id", teamId)
      .eq("duty_type", "hotline")
      .order("date", { ascending: false });

    const lastAssignmentMap = new Map<string, Date>();
    lastAssignments?.forEach(a => {
      if (!lastAssignmentMap.has(a.user_id)) {
        lastAssignmentMap.set(a.user_id, new Date(a.date));
      }
    });

    return (profiles || []).map(p => ({
      user_id: p.user_id,
      first_name: p.first_name,
      last_name: p.last_name,
      last_hotline_date: lastAssignmentMap.get(p.user_id),
    }));
  };

  const checkAvailability = async (
    userId: string,
    date: Date,
    teamId: string
  ): Promise<boolean> => {
    const dateStr = format(date, "yyyy-MM-dd");

    // Check schedule entry
    const { data: entry } = await supabase
      .from("schedule_entries")
      .select("activity_type, availability_status")
      .eq("user_id", userId)
      .eq("date", dateStr)
      .single();

    // No entry = available by default (not on vacation/sick)
    if (!entry) return true;

    // If entry exists, check availability status
    if (entry.availability_status !== "available") return false;

    // Not available if on vacation, sick, flextime, etc.
    if (["vacation", "flextime", "other", "out_of_office"].includes(entry.activity_type)) {
      return false;
    }

    // Check for holidays
    const { data: profile } = await supabase
      .from("profiles")
      .select("country_code, region_code")
      .eq("user_id", userId)
      .single();

    if (profile) {
      const { data: holiday } = await supabase
        .from("holidays")
        .select("id")
        .eq("date", dateStr)
        .eq("country_code", profile.country_code)
        .eq("is_public", true)
        .is("user_id", null)
        .limit(1)
        .single();

      if (holiday) return false;
    }

    return true;
  };

  const generateHotlineSchedule = async (
    teamIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<DraftAssignment[]> => {
    setLoading(true);
    try {
      const allDrafts: DraftAssignment[] = [];

      for (const teamId of teamIds) {
        // Fetch team config
        const { data: config, error: configError } = await supabase
          .from("hotline_team_config")
          .select("*")
          .eq("team_id", teamId)
          .single();

        if (configError || !config) {
          toast({
            title: "Configuration Missing",
            description: `Hotline configuration not set for one of the teams.`,
            variant: "destructive",
          });
          continue;
        }

        // Fetch eligible members
        const eligibleMembers = await fetchEligibleMembers(teamId);

        if (eligibleMembers.length === 0) {
          toast({
            title: "No Eligible Members",
            description: `No eligible members configured for one of the teams.`,
            variant: "destructive",
          });
          continue;
        }

        // Sort by least recent assignment
        const sortedMembers = [...eligibleMembers].sort((a, b) => {
          const aTime = a.last_hotline_date?.getTime() || 0;
          const bTime = b.last_hotline_date?.getTime() || 0;
          return aTime - bTime;
        });

        // Generate assignments for each weekday
        const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
        let memberIndex = 0;

        for (const date of dateRange) {
          const dayOfWeek = getDay(date);

          // Skip weekends
          if (dayOfWeek === 0 || dayOfWeek === 6) continue;

          const isFriday = dayOfWeek === 5;
          const startTime = isFriday
            ? config.friday_start_time
            : config.weekday_start_time;
          const endTime = isFriday
            ? config.friday_end_time
            : config.weekday_end_time;

          // Assign required number of staff
          for (let i = 0; i < config.min_staff_required; i++) {
            let assigned = false;
            let attempts = 0;
            let originalUserId: string | undefined;

            while (!assigned && attempts < sortedMembers.length) {
              const member = sortedMembers[memberIndex % sortedMembers.length];

              // Check availability
              const isAvailable = await checkAvailability(member.user_id, date, teamId);

              if (isAvailable) {
                allDrafts.push({
                  team_id: teamId,
                  user_id: member.user_id,
                  date,
                  start_time: startTime,
                  end_time: endTime,
                  is_substitute: attempts > 0,
                  original_user_id: originalUserId,
                });
                assigned = true;
                memberIndex++;
              } else {
                if (attempts === 0) {
                  originalUserId = member.user_id;
                }
                attempts++;
                memberIndex++;
              }
            }

            if (!assigned) {
              toast({
                title: "Warning",
                description: `Could not assign hotline for ${format(date, "MMM dd, yyyy")}`,
                variant: "destructive",
              });
            }
          }
        }
      }

      return allDrafts;
    } catch (error: any) {
      console.error("Error generating hotline schedule:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate hotline schedule",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const saveDrafts = async (drafts: DraftAssignment[], userId: string) => {
    setLoading(true);
    try {
      // Clear existing drafts
      const teamIds = [...new Set(drafts.map(d => d.team_id))];
      for (const teamId of teamIds) {
        await supabase
          .from("hotline_draft_assignments")
          .delete()
          .eq("team_id", teamId);
      }

      // Insert new drafts
      const { error } = await supabase.from("hotline_draft_assignments").insert(
        drafts.map(d => ({
          team_id: d.team_id,
          user_id: d.user_id,
          date: format(d.date, "yyyy-MM-dd"),
          start_time: d.start_time,
          end_time: d.end_time,
          is_substitute: d.is_substitute,
          original_user_id: d.original_user_id,
          created_by: userId,
        }))
      );

      if (error) throw error;

      toast({
        title: "Success",
        description: "Hotline schedule draft saved",
      });
    } catch (error: any) {
      console.error("Error saving drafts:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save drafts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const finalizeDrafts = async (teamIds: string[], userId: string) => {
    setLoading(true);
    try {
      // Fetch all drafts
      const { data: drafts, error: fetchError } = await supabase
        .from("hotline_draft_assignments")
        .select("*")
        .in("team_id", teamIds)
        .eq("status", "draft");

      if (fetchError) throw fetchError;

      if (!drafts || drafts.length === 0) {
        toast({
          title: "No Drafts",
          description: "No draft assignments to finalize",
          variant: "destructive",
        });
        return;
      }

      // Insert into duty_assignments
      const { error: insertError } = await supabase.from("duty_assignments").insert(
        drafts.map(d => ({
          team_id: d.team_id,
          user_id: d.user_id,
          date: d.date,
          duty_type: "hotline" as const,
          is_substitute: d.is_substitute,
          year: new Date(d.date).getFullYear(),
          week_number: Math.ceil(
            (new Date(d.date).getTime() - new Date(new Date(d.date).getFullYear(), 0, 1).getTime()) /
              (7 * 24 * 60 * 60 * 1000)
          ),
          notes: `${d.start_time}-${d.end_time}`,
          created_by: userId,
        }))
      );

      if (insertError) throw insertError;

      // Delete drafts
      const { error: deleteError } = await supabase
        .from("hotline_draft_assignments")
        .delete()
        .in("team_id", teamIds);

      if (deleteError) throw deleteError;

      toast({
        title: "Success",
        description: `Finalized ${drafts.length} hotline assignments`,
      });
    } catch (error: any) {
      console.error("Error finalizing drafts:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to finalize hotline schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper: Format time as HH:MM (strip seconds if present)
  const formatTimeWithoutSeconds = (time: string): string => {
    // If time is in HH:MM:SS format, strip the seconds
    if (time && time.length > 5) {
      return time.substring(0, 5);
    }
    return time;
  };

  // Helper: Parse time blocks from notes
  const parseTimeBlocksFromNotes = (notes: string | null): Array<{ activity_type: string; start_time: string; end_time: string }> | null => {
    if (!notes) return null;
    
    const timeSplitPattern = /Times:\s*(.+)/;
    const match = notes.match(timeSplitPattern);
    
    if (match) {
      try {
        const timesData = JSON.parse(match[1]);
        if (Array.isArray(timesData)) {
          return timesData;
        }
      } catch (e) {
        console.error("Failed to parse time blocks from notes");
      }
    }
    
    return null;
  };

  // Helper: Create default time block from shift type
  const getDefaultTimeBlock = (shiftType: string | null): { activity_type: string; start_time: string; end_time: string } => {
    let start = '08:00';
    let end = '16:30';
    
    switch (shiftType) {
      case 'early':
        start = '06:00';
        end = '14:30';
        break;
      case 'late':
        start = '13:00';
        end = '21:30';
        break;
    }
    
    return {
      activity_type: 'work',
      start_time: start,
      end_time: end
    };
  };

  const generateAndSaveHotlineForTeam = async (
    teamId: string,
    startDate: Date,
    endDate: Date,
    userId: string
  ): Promise<number> => {
    try {
      // Fetch team config
      const { data: config, error: configError } = await supabase
        .from("hotline_team_config")
        .select("*")
        .eq("team_id", teamId)
        .single();

      if (configError || !config) {
        return 0; // No config, skip hotline
      }

      // Fetch eligible members
      const eligibleMembers = await fetchEligibleMembers(teamId);

      if (eligibleMembers.length === 0) {
        return 0; // No eligible members
      }

      // Sort by least recent assignment
      const sortedMembers = [...eligibleMembers].sort((a, b) => {
        const aTime = a.last_hotline_date?.getTime() || 0;
        const bTime = b.last_hotline_date?.getTime() || 0;
        return aTime - bTime;
      });

      // Generate date strings for the range
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
      
      let memberIndex = 0;
      let updatedCount = 0;

      for (const date of dateRange) {
        const dayOfWeek = getDay(date);

        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const isFriday = dayOfWeek === 5;
        const startTime = isFriday
          ? config.friday_start_time
          : config.weekday_start_time;
        const endTime = isFriday
          ? config.friday_end_time
          : config.weekday_end_time;

        const dateStr = format(date, "yyyy-MM-dd");

        // Assign exactly min_staff_required per day
        for (let i = 0; i < config.min_staff_required; i++) {
          let assigned = false;
          let attempts = 0;

          while (!assigned && attempts < sortedMembers.length) {
            const member = sortedMembers[memberIndex % sortedMembers.length];

            // Check availability
            const isAvailable = await checkAvailability(member.user_id, date, teamId);

            if (isAvailable) {
              // Fetch existing schedule entry for this user/date/team
              const { data: existingEntry } = await supabase
                .from("schedule_entries")
                .select("id, notes, activity_type, shift_type")
                .eq("user_id", member.user_id)
                .eq("date", dateStr)
                .eq("team_id", teamId)
                .single();

              if (existingEntry) {
                // Parse existing time blocks or create default
                let timeBlocks = parseTimeBlocksFromNotes(existingEntry.notes);
                
                if (!timeBlocks) {
                  // No existing time blocks, create from shift_type
                  timeBlocks = [getDefaultTimeBlock(existingEntry.shift_type)];
                }

            // Add hotline time block with normalized time format
            timeBlocks.push({
              activity_type: "hotline_support",
              start_time: formatTimeWithoutSeconds(startTime),
              end_time: formatTimeWithoutSeconds(endTime)
            });

                // Update entry with new notes containing all time blocks
                const { error: updateError } = await supabase
                  .from("schedule_entries")
                  .update({ 
                    notes: `Times: ${JSON.stringify(timeBlocks)}`,
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", existingEntry.id);

                if (updateError) {
                  console.error("Error updating entry with hotline:", updateError);
                } else {
                  updatedCount++;
                }
              } else {
                // No existing entry - create hotline-only entry (shouldn't happen in bulk scheduling)
                const { error: insertError } = await supabase
                  .from("schedule_entries")
                  .insert({
                    team_id: teamId,
                    user_id: member.user_id,
                    date: dateStr,
                    activity_type: "hotline_support",
                    availability_status: "available",
                    shift_type: null,
                    notes: `Times: ${JSON.stringify([{
                      activity_type: "hotline_support",
                      start_time: startTime,
                      end_time: endTime
                    }])}`,
                    created_by: userId,
                  });

                if (insertError) {
                  console.error("Error creating hotline entry:", insertError);
                } else {
                  updatedCount++;
                }
              }

              assigned = true;
              memberIndex++;
              break;
            } else {
              attempts++;
              memberIndex++;
            }
          }

          if (!assigned) {
            console.warn(`Could not assign hotline for ${dateStr}, slot ${i + 1}`);
          }
        }
      }

      return updatedCount;
    } catch (error: any) {
      console.error("Error auto-generating hotline:", error);
      return 0;
    }
  };

  return {
    loading,
    generateHotlineSchedule,
    saveDrafts,
    finalizeDrafts,
    generateAndSaveHotlineForTeam,
  };
};
