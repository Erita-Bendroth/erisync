import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScheduleEntry, ShiftPattern } from './useSchedulerState';
import { Database } from '@/integrations/supabase/types';
import { getApplicableShiftTimes } from '@/lib/shiftTimeUtils';
import { validateWeekendShift, isDateWeekend } from '@/lib/shiftValidation';

type ShiftType = Database['public']['Enums']['shift_type'];
type ActivityType = Database['public']['Enums']['activity_type'];
type AvailabilityStatus = Database['public']['Enums']['availability_status'];

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
  country_code?: string | null;
  region_code?: string | null;
}

interface TeamSection {
  teamId: string;
  teamName: string;
  members: TeamMember[];
  color: string;
}

export const useSchedulerActions = (
  scheduleEntries: ScheduleEntry[],
  onUpdate: (entries: ScheduleEntry[]) => void,
  userId: string,
  teamSections: TeamSection[]
) => {
  const { toast } = useToast();

  const copyPattern = useCallback((cellIds: string[]): ShiftPattern[] => {
    const pattern: ShiftPattern[] = [];
    
    cellIds.forEach(cellId => {
      const [user_id, date] = cellId.split(':');
      const entry = scheduleEntries.find(e => e.user_id === user_id && e.date === date);
      
      if (entry) {
        pattern.push({
          user_id: entry.user_id,
          date: entry.date,
          shift_type: entry.shift_type,
          activity_type: entry.activity_type,
          availability_status: entry.availability_status,
        });
      }
    });
    
    return pattern;
  }, [scheduleEntries]);

  const pastePattern = useCallback(async (
    pattern: ShiftPattern[],
    targetCellIds: string[]
  ) => {
    if (pattern.length === 0 || targetCellIds.length === 0) return;

    try {
      // Calculate date offset from first pattern item to first target
      const firstPatternDate = new Date(pattern[0].date);
      const [firstTargetUser, firstTargetDate] = targetCellIds[0].split(':');
      const targetDate = new Date(firstTargetDate);
      const dayOffset = Math.floor((targetDate.getTime() - firstPatternDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Build entries with country-aware shift definitions
      const newEntries: (ScheduleEntry & { shift_time_definition_id?: string | null })[] = [];
      
      for (const cellId of targetCellIds) {
        const [user_id, date] = cellId.split(':');
        
        // Find which team this user belongs to and get member info
        const userTeam = teamSections.find(section =>
          section.members.some(m => m.user_id === user_id)
        );
        
        if (!userTeam) {
          console.warn(`User ${user_id} not found in any team section`);
          continue;
        }
        
        const member = userTeam.members.find(m => m.user_id === user_id);
        
        // Find matching pattern entry based on relative position
        const patternEntry = pattern.find(p => {
          const pDate = new Date(p.date);
          const pAdjusted = new Date(pDate);
          pAdjusted.setDate(pAdjusted.getDate() + dayOffset);
          return pAdjusted.toISOString().split('T')[0] === date;
        });
        
        if (patternEntry && patternEntry.shift_type) {
          // Get country-aware shift definition
          const dayOfWeek = new Date(date).getDay();
          const applicableShift = await getApplicableShiftTimes({
            teamId: userTeam.teamId,
            regionCode: member?.region_code || undefined,
            countryCode: member?.country_code || undefined,
            shiftType: patternEntry.shift_type,
            dayOfWeek,
            date,
          });
          
          newEntries.push({
            user_id,
            team_id: userTeam.teamId,
            date,
            shift_type: patternEntry.shift_type,
            activity_type: patternEntry.activity_type,
            availability_status: patternEntry.availability_status,
            shift_time_definition_id: applicableShift?.id?.startsWith('default-') ? null : applicableShift?.id || null,
            notes: `Pasted from pattern - ${applicableShift?.description || patternEntry.shift_type}`,
          });
        } else if (patternEntry) {
          newEntries.push({
            user_id,
            team_id: userTeam.teamId,
            date,
            shift_type: patternEntry.shift_type,
            activity_type: patternEntry.activity_type,
            availability_status: patternEntry.availability_status,
            notes: 'Pasted from pattern',
          });
        }
      }
      
      // Optimistic update
      const updatedEntries = [...scheduleEntries];
      newEntries.forEach(newEntry => {
        const existingIndex = updatedEntries.findIndex(
          e => e.user_id === newEntry.user_id && e.date === newEntry.date && e.team_id === newEntry.team_id
        );
        if (existingIndex >= 0) {
          updatedEntries[existingIndex] = { ...updatedEntries[existingIndex], ...newEntry };
        } else {
          updatedEntries.push(newEntry);
        }
      });
      onUpdate(updatedEntries);
      
      // Save to database (batch operation)
      const { error } = await supabase
        .from('schedule_entries')
        .upsert(newEntries.map(entry => ({
          ...entry,
          created_by: userId,
        })), {
          onConflict: 'user_id,date,team_id',
        });
      
      if (error) throw error;
      
      toast({
        title: "Pattern pasted",
        description: `Applied pattern to ${newEntries.length} cells`,
      });
    } catch (error) {
      console.error('Error pasting pattern:', error);
      toast({
        title: "Error",
        description: "Failed to paste pattern",
        variant: "destructive",
      });
    }
  }, [scheduleEntries, onUpdate, userId, toast, teamSections]);

  const bulkAssignShift = useCallback(async (
    cellIds: string[],
    shiftType: ShiftType
  ) => {
    try {
      // For weekend shifts, filter to only valid dates (weekends/holidays)
      let validCellIds = cellIds;
      let skippedCount = 0;
      
      if (shiftType === 'weekend') {
        validCellIds = [];
        for (const cellId of cellIds) {
          const [user_id, date] = cellId.split(':');
          
          // Quick check for weekends first
          if (isDateWeekend(date)) {
            validCellIds.push(cellId);
          } else {
            // More thorough check with holiday lookup
            const member = teamSections.flatMap(s => s.members).find(m => m.user_id === user_id);
            const validation = await validateWeekendShift(shiftType, date, member?.country_code);
            if (validation.isValid) {
              validCellIds.push(cellId);
            } else {
              skippedCount++;
            }
          }
        }
        
        if (skippedCount > 0) {
          toast({
            title: "Some dates skipped",
            description: `${skippedCount} weekday(s) were skipped - weekend shifts only allowed on weekends/holidays`,
          });
        }
        
        if (validCellIds.length === 0) {
          toast({
            title: "No valid dates",
            description: "Weekend shifts can only be assigned on weekends or public holidays",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Build entries with country-aware shift definitions
      const newEntries: (ScheduleEntry & { shift_time_definition_id?: string | null })[] = [];
      
      for (const cellId of validCellIds) {
        const [user_id, date] = cellId.split(':');
        
        // Find which team this user belongs to and get member info
        const userTeam = teamSections.find(section =>
          section.members.some(m => m.user_id === user_id)
        );
        
        if (!userTeam) {
          console.warn(`User ${user_id} not found in any team section`);
          continue;
        }
        
        const member = userTeam.members.find(m => m.user_id === user_id);
        
        // Get country-aware shift definition
        const dayOfWeek = new Date(date).getDay();
        const applicableShift = await getApplicableShiftTimes({
          teamId: userTeam.teamId,
          regionCode: member?.region_code || undefined,
          countryCode: member?.country_code || undefined,
          shiftType: shiftType,
          dayOfWeek,
          date,
        });
        
        newEntries.push({
          user_id,
          team_id: userTeam.teamId,
          date,
          shift_type: shiftType,
          activity_type: 'work' as ActivityType,
          availability_status: 'available' as AvailabilityStatus,
          shift_time_definition_id: applicableShift?.id?.startsWith('default-') ? null : applicableShift?.id || null,
          notes: `Bulk assigned - ${applicableShift?.description || shiftType}`,
        });
      }
      
      // Optimistic update
      const updatedEntries = [...scheduleEntries];
      newEntries.forEach(newEntry => {
        const existingIndex = updatedEntries.findIndex(
          e => e.user_id === newEntry.user_id && e.date === newEntry.date && e.team_id === newEntry.team_id
        );
        if (existingIndex >= 0) {
          updatedEntries[existingIndex] = { ...updatedEntries[existingIndex], ...newEntry };
        } else {
          updatedEntries.push(newEntry);
        }
      });
      onUpdate(updatedEntries);
      
      // Save to database
      const { error } = await supabase
        .from('schedule_entries')
        .upsert(newEntries.map(entry => ({
          ...entry,
          created_by: userId,
        })), {
          onConflict: 'user_id,date,team_id',
        });
      
      if (error) throw error;
      
      toast({
        title: "Shifts assigned",
        description: `Assigned ${shiftType} shift to ${newEntries.length} cells`,
      });
    } catch (error) {
      console.error('Error assigning shifts:', error);
      toast({
        title: "Error",
        description: "Failed to assign shifts",
        variant: "destructive",
      });
    }
  }, [scheduleEntries, onUpdate, userId, toast, teamSections]);

  const clearCells = useCallback(async (cellIds: string[]) => {
    try {
      const deletions = cellIds.map(cellId => {
        const [user_id, date] = cellId.split(':');
        
        // Find which team this user belongs to
        const userTeam = teamSections.find(section =>
          section.members.some(m => m.user_id === user_id)
        );
        
        if (!userTeam) {
          console.warn(`User ${user_id} not found in any team section`);
          return null;
        }
        
        return { user_id, date, team_id: userTeam.teamId };
      }).filter((deletion): deletion is { user_id: string; date: string; team_id: string } => deletion !== null);
      
      // Optimistic update
      const updatedEntries = scheduleEntries.filter(entry => 
        !cellIds.includes(`${entry.user_id}:${entry.date}`)
      );
      onUpdate(updatedEntries);
      
      // Delete from database
      for (const { user_id, date, team_id } of deletions) {
        await supabase
          .from('schedule_entries')
          .delete()
          .eq('user_id', user_id)
          .eq('date', date)
          .eq('team_id', team_id);
      }
      
      toast({
        title: "Cells cleared",
        description: `Cleared ${cellIds.length} cells`,
      });
    } catch (error) {
      console.error('Error clearing cells:', error);
      toast({
        title: "Error",
        description: "Failed to clear cells",
        variant: "destructive",
      });
    }
  }, [scheduleEntries, onUpdate, toast, teamSections]);

  return {
    copyPattern,
    pastePattern,
    bulkAssignShift,
    clearCells,
  };
};
