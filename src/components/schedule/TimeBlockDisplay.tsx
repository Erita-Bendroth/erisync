import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getShiftTimes, doesShiftCrossMidnight } from '@/lib/utils';

interface TimeBlock {
  activity_type: string;
  start_time: string;
  end_time: string;
}

interface ScheduleEntry {
  id: string;
  user_id: string;
  activity_type: string;
  shift_type: string;
  notes?: string;
}

interface TimeBlockDisplayProps {
  entry: ScheduleEntry;
  onClick?: (e?: any) => void;
  className?: string;
  showNotes?: boolean;
  userRole?: string;
  isContinuation?: boolean; // Flag to indicate this is the continuation part of a night shift
  originalStartTime?: string; // Original start time from previous day
}

const getActivityColor = (activityType: string, shiftType?: string) => {
  // For work activities, use shift type colors matching the legend
  if (activityType === "work") {
    switch (shiftType) {
      case "early":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "late":
        return "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300";
      case "normal":
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
    }
  }
  
  // For other activities, use activity type colors
  switch (activityType) {
    case "vacation":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "other":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "hotline_support":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "out_of_office":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    case "training":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
    case "flextime":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
    case "working_from_home":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
};

const getActivityDisplayName = (activityType: string, shiftType?: string) => {
  // If activity is work, show the shift type instead
  if (activityType === 'work' && shiftType) {
    switch (shiftType) {
      case 'early': return 'Early Shift';
      case 'late': return 'Late Shift';
      case 'normal': return 'Normal Shift';
      default: return 'Work';
    }
  }
  
  // For non-work activities, show the activity type
  switch (activityType) {
    case "work": return "Work";
    case "vacation": return "Vacation";
    case "other": return "Other";
    case "hotline_support": return "Hotline Support";
    case "out_of_office": return "Out of Office";
    case "training": return "Training";
    case "flextime": return "Flextime";
    case "working_from_home": return "Working from Home";
    default: return activityType;
  }
};

export const TimeBlockDisplay: React.FC<TimeBlockDisplayProps> = ({ 
  entry, 
  onClick, 
  className = "",
  showNotes = false,
  userRole = "",
  isContinuation = false,
  originalStartTime = ""
}) => {
  // Check if this is a holiday entry (activity_type = 'other' with "Public holiday:" in notes)
  const isHoliday = entry.activity_type === 'other' && entry.notes?.includes('Public holiday:');
  
  // If it's a holiday, display ONLY the holiday name badge with NO time information
  if (isHoliday) {
    const holidayName = entry.notes?.replace(/Public holiday:\s*/, '').trim() || 'Holiday';
    return (
      <div className={`w-full ${className}`}>
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <div className="w-full cursor-help">
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 block text-xs w-full pointer-events-auto"
                >
                  <div className="flex flex-col items-center py-1 w-full min-w-0">
                    <span className="font-medium truncate max-w-full">
                      🎉 {holidayName}
                    </span>
                  </div>
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent className="z-[100]" side="top">
              <p className="max-w-xs">🎉 {holidayName}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }
  
  // Check if entry has time split information in notes
  const timeSplitPattern = /Times:\s*(.+)/;
  const match = entry.notes?.match(timeSplitPattern);
  
  let timeBlocks: TimeBlock[] = [];
  let hasTimeSplit = false;
  
  if (match) {
    try {
      const timesData = JSON.parse(match[1]);
      if (Array.isArray(timesData)) {
        timeBlocks = timesData;
        hasTimeSplit = true;
      }
    } catch (e) {
      console.error("Failed to parse time split data");
    }
  }
  
  // Also check for old format: (HH:MM-HH:MM) in notes
  if (!hasTimeSplit && entry.notes) {
    const oldTimePattern = /\((\d{2}:\d{2})-(\d{2}:\d{2})\)/;
    const oldMatch = entry.notes.match(oldTimePattern);
    if (oldMatch) {
      timeBlocks = [{
        activity_type: entry.activity_type,
        start_time: oldMatch[1],
        end_time: oldMatch[2]
      }];
      hasTimeSplit = true;
    }
  }

  // Default shift times if no time split
  const getDefaultTimes = (shiftType: string) => {
    switch (shiftType) {
      case 'early':
        return { start: '06:00', end: '14:30' };
      case 'late':
        return { start: '13:00', end: '21:30' };
      default:
        return { start: '08:00', end: '16:30' };
    }
  };

  // Extract clean notes (remove JSON artifacts)
  const getCleanNotes = () => {
    if (!entry.notes) return "";
    
    // Remove JSON time data and auto-generated text
    let cleanNotes = entry.notes
      .replace(/Times:\s*\[.*?\]/g, "")
      .replace(/Auto-generated shift.*?\)/g, "")
      .replace(/^\s*\n+/g, "")
      .trim();
    
    return cleanNotes;
  };

  const cleanNotes = getCleanNotes();
  const isTeamMember = userRole === "teammember";
  const [expanded, setExpanded] = useState(false);

  if (hasTimeSplit && timeBlocks.length > 0) {
    // Display time blocks with specific times
    return (
      <div className={`space-y-1 ${className}`}>
        {timeBlocks.map((block, index) => (
          <div key={index} className="w-full">
            <Badge
              variant="secondary"
              className={`${getActivityColor(block.activity_type, entry.shift_type)} block cursor-pointer hover:opacity-80 transition-opacity text-xs w-full`}
              onClick={onClick}
            >
              <div className="flex flex-col items-center py-1 w-full" onClick={() => setExpanded(!expanded)}>
                <span className="font-medium">
                  {getActivityDisplayName(block.activity_type, entry.shift_type)}
                </span>
                <span className="text-xs">
                  {block.start_time}–{block.end_time}
                </span>
              </div>
            </Badge>
            {/* Show notes for team members */}
            {isTeamMember && cleanNotes && index === 0 && expanded && (
              <div className="mt-1 p-2 bg-muted rounded text-xs text-muted-foreground">
                <strong>Notes:</strong> {cleanNotes}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  } else {
    // Display single block with default shift times
    const times = getShiftTimes(entry.notes, entry.shift_type);
    const crossesMidnight = doesShiftCrossMidnight(times.start, times.end);
    
    // If this is a continuation badge, show end time with start from previous day
    if (isContinuation) {
      return (
        <div className={`w-full ${className}`}>
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div className="w-full">
                  <Badge
                    variant="secondary"
                    className={`${getActivityColor(entry.activity_type, entry.shift_type)} block cursor-pointer hover:opacity-80 transition-opacity text-xs w-full border-2 border-dashed border-orange-400/50`}
                    style={{ 
                      opacity: 0.85
                    }}
                    onClick={onClick}
                  >
                    <div className="flex flex-col items-center py-1 w-full">
                      <span className="font-medium text-xs flex items-center gap-1">
                        <span className="text-orange-600 dark:text-orange-400 font-bold">←</span>
                        {getActivityDisplayName(entry.activity_type, entry.shift_type)}
                      </span>
                      <span className="text-[10px]">
                        ends at {times.end}
                      </span>
                      <span className="text-[9px] text-muted-foreground italic">
                        from previous day
                      </span>
                    </div>
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent className="z-[100]" side="top">
                <p className="max-w-xs">
                  <strong>{getActivityDisplayName(entry.activity_type, entry.shift_type)}</strong>
                  <br />
                  Full shift: {originalStartTime || times.start} – {times.end}
                  <br />
                  <span className="text-xs text-orange-500">🌙 Continues from previous day</span>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    }
    
    // Regular display - show indicator if shift crosses midnight
    return (
      <div className={`w-full ${className}`}>
        {crossesMidnight && (
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div className="w-full">
                  <Badge
                    variant="secondary"
                    className={`${getActivityColor(entry.activity_type, entry.shift_type)} block cursor-pointer hover:opacity-80 transition-opacity text-xs w-full`}
                    onClick={onClick}
                  >
                    <div className="flex flex-col items-center py-1 w-full" onClick={() => setExpanded(!expanded)}>
                      <span className="font-medium flex items-center gap-1">
                        {getActivityDisplayName(entry.activity_type, entry.shift_type)}
                        <span className="text-orange-600 dark:text-orange-400 font-bold">→</span>
                      </span>
                      <span className="text-xs">
                        {times.start}–{times.end}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Continues next day
                      </span>
                    </div>
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent className="z-[100]" side="top">
                <p className="max-w-xs">
                  <strong>{getActivityDisplayName(entry.activity_type, entry.shift_type)}</strong>
                  <br />
                  {times.start} – {times.end}
                  <br />
                  <span className="text-xs text-orange-500">⚠️ This shift continues into the next day</span>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {!crossesMidnight && (
          <Badge
            variant="secondary"
            className={`${getActivityColor(entry.activity_type, entry.shift_type)} block cursor-pointer hover:opacity-80 transition-opacity text-xs w-full`}
            onClick={onClick}
          >
            <div className="flex flex-col items-center py-1 w-full" onClick={() => setExpanded(!expanded)}>
              <span className="font-medium">
                {getActivityDisplayName(entry.activity_type, entry.shift_type)}
              </span>
              <span className="text-xs">
                {times.start}–{times.end}
              </span>
            </div>
          </Badge>
        )}
        
        {/* Show notes for team members */}
        {isTeamMember && cleanNotes && expanded && (
          <div className="mt-1 p-2 bg-muted rounded text-xs text-muted-foreground">
            <strong>Notes:</strong> {cleanNotes}
          </div>
        )}
      </div>
    );
  }
};