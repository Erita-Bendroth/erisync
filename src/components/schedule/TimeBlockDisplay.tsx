import React from 'react';
import { Badge } from '@/components/ui/badge';

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
}

const getActivityColor = (activityType: string) => {
  switch (activityType) {
    case "work":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "vacation":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "sick":
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

const getActivityDisplayName = (activityType: string) => {
  switch (activityType) {
    case "work": return "Work";
    case "vacation": return "Vacation";
    case "sick": return "Other";
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
  className = "" 
}) => {
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

  if (hasTimeSplit && timeBlocks.length > 0) {
    // Display time blocks with specific times
    return (
      <div className={`space-y-1 ${className}`}>
        {timeBlocks.map((block, index) => (
          <Badge
            key={index}
            variant="secondary"
            className={`${getActivityColor(block.activity_type)} block cursor-pointer hover:opacity-80 transition-opacity text-xs`}
            onClick={onClick}
          >
            <div className="flex flex-col items-center py-1">
              <span className="font-medium">
                {getActivityDisplayName(block.activity_type)}
              </span>
              <span className="text-xs">
                {block.start_time}–{block.end_time}
              </span>
            </div>
          </Badge>
        ))}
      </div>
    );
  } else {
    // Display single block with default shift times
    const defaultTimes = getDefaultTimes(entry.shift_type);
    return (
      <Badge
        variant="secondary"
        className={`${getActivityColor(entry.activity_type)} block cursor-pointer hover:opacity-80 transition-opacity text-xs ${className}`}
        onClick={onClick}
      >
        <div className="flex flex-col items-center py-1">
          <span className="font-medium">
            {getActivityDisplayName(entry.activity_type)}
          </span>
          <span className="text-xs">
            {defaultTimes.start}–{defaultTimes.end}
          </span>
        </div>
      </Badge>
    );
  }
};