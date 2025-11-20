import { useState, useCallback } from 'react';
import { Database } from '@/integrations/supabase/types';

type ShiftType = Database['public']['Enums']['shift_type'];
type ActivityType = Database['public']['Enums']['activity_type'];
type AvailabilityStatus = Database['public']['Enums']['availability_status'];

export interface ScheduleEntry {
  id?: string;
  user_id: string;
  team_id: string;
  date: string;
  shift_type: ShiftType | null;
  shift_time_definition_id?: string | null;
  activity_type: ActivityType;
  availability_status: AvailabilityStatus;
  notes?: string;
}

export interface ShiftPattern {
  user_id: string;
  date: string;
  shift_type: ShiftType | null;
  activity_type: ActivityType;
  availability_status: AvailabilityStatus;
}

export interface SchedulerState {
  selectedCells: Set<string>;
  selectedUsers: Set<string>;
  clipboardPattern: ShiftPattern[];
  hoveredCell: string | null;
  editingCell: string | null;
  dragStart: string | null;
  dragEnd: string | null;
  isDragging: boolean;
}

export const useSchedulerState = () => {
  const [state, setState] = useState<SchedulerState>({
    selectedCells: new Set(),
    selectedUsers: new Set(),
    clipboardPattern: [],
    hoveredCell: null,
    editingCell: null,
    dragStart: null,
    dragEnd: null,
    isDragging: false,
  });

  const toggleUserSelection = useCallback((userId: string) => {
    setState(prev => {
      const newSelectedUsers = new Set(prev.selectedUsers);
      if (newSelectedUsers.has(userId)) {
        newSelectedUsers.delete(userId);
      } else {
        newSelectedUsers.add(userId);
      }
      return { ...prev, selectedUsers: newSelectedUsers };
    });
  }, []);

  const toggleCellSelection = useCallback((cellId: string) => {
    setState(prev => {
      const newSelectedCells = new Set(prev.selectedCells);
      if (newSelectedCells.has(cellId)) {
        newSelectedCells.delete(cellId);
      } else {
        newSelectedCells.add(cellId);
      }
      return { ...prev, selectedCells: newSelectedCells };
    });
  }, []);

  const selectAllUsers = useCallback((userIds: string[]) => {
    setState(prev => ({
      ...prev,
      selectedUsers: new Set(userIds),
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedCells: new Set(),
      selectedUsers: new Set(),
    }));
  }, []);

  const setClipboard = useCallback((pattern: ShiftPattern[]) => {
    setState(prev => ({ ...prev, clipboardPattern: pattern }));
  }, []);

  const setHoveredCell = useCallback((cellId: string | null) => {
    setState(prev => ({ ...prev, hoveredCell: cellId }));
  }, []);

  const setEditingCell = useCallback((cellId: string | null) => {
    setState(prev => ({ ...prev, editingCell: cellId }));
  }, []);

  const startDrag = useCallback((cellId: string) => {
    setState(prev => ({
      ...prev,
      dragStart: cellId,
      dragEnd: cellId,
      isDragging: true,
    }));
  }, []);

  const updateDragEnd = useCallback((cellId: string) => {
    setState(prev => ({
      ...prev,
      dragEnd: cellId,
    }));
  }, []);

  const endDrag = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDragging: false,
    }));
  }, []);

  const selectRange = useCallback((startCellId: string, endCellId: string, userIds: string[]) => {
    const [startUser, startDate] = startCellId.split(':');
    const [endUser, endDate] = endCellId.split(':');
    
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const [minDate, maxDate] = startDateObj <= endDateObj ? [startDateObj, endDateObj] : [endDateObj, startDateObj];
    
    const selectedCells = new Set<string>();
    userIds.forEach(userId => {
      const currentDate = new Date(minDate);
      while (currentDate <= maxDate) {
        selectedCells.add(`${userId}:${currentDate.toISOString().split('T')[0]}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    setState(prev => ({ ...prev, selectedCells }));
  }, []);

  return {
    state,
    toggleUserSelection,
    toggleCellSelection,
    selectAllUsers,
    clearSelection,
    setClipboard,
    setHoveredCell,
    setEditingCell,
    startDrag,
    updateDragEnd,
    endDrag,
    selectRange,
  };
};
