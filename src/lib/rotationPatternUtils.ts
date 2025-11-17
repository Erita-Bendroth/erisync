import { format, addDays, getDay } from 'date-fns';

export interface ScheduleEntry {
  user_id: string;
  date: string;
  shift_type: string | null;
  team_id: string;
  activity_type: 'work' | 'vacation' | 'other';
  availability_status: 'available' | 'unavailable';
  notes?: string;
}

export interface PatternConfig {
  type: 'fixed_days' | 'repeating_sequence' | 'weekly_pattern' | 'custom';
  [key: string]: any;
}

export const getDayOfWeekName = (date: Date): string => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[getDay(date)];
};

export const isWeekend = (date: Date): boolean => {
  const day = getDay(date);
  return day === 0 || day === 6;
};

export const applyRotationPattern = (
  config: PatternConfig,
  userId: string,
  teamId: string,
  dates: string[],
  options: {
    skipWeekends?: boolean;
    skipHolidays?: boolean;
    holidays?: string[];
  } = {}
): ScheduleEntry[] => {
  const entries: ScheduleEntry[] = [];

  switch (config.type) {
    case 'fixed_days': {
      // E.g., 4-on-4-off
      const { work_days, off_days, shift_type } = config.cycle;
      const cycleLength = work_days + off_days;
      let dayIndex = 0;

      dates.forEach((date) => {
        const currentDate = new Date(date);
        const isHoliday = options.skipHolidays && options.holidays?.includes(date);
        const isWeekendDay = options.skipWeekends && isWeekend(currentDate);

        if (isHoliday || isWeekendDay) {
          entries.push({
            user_id: userId,
            date,
            shift_type: null,
            team_id: teamId,
            activity_type: 'other',
            availability_status: 'unavailable',
            notes: isHoliday ? 'Holiday' : 'Weekend',
          });
          return;
        }

        const positionInCycle = dayIndex % cycleLength;
        const isWorkDay = positionInCycle < work_days;

        entries.push({
          user_id: userId,
          date,
          shift_type: isWorkDay ? shift_type : null,
          team_id: teamId,
          activity_type: isWorkDay ? 'work' : 'other',
          availability_status: isWorkDay ? 'available' : 'unavailable',
        });

        dayIndex++;
      });
      break;
    }

    case 'repeating_sequence': {
      // E.g., Early-Early-Late-Late-Off
      let dayIndex = 0;
      let currentStep = 0;
      let daysInCurrentStep = 0;

      dates.forEach((date) => {
        const step = config.sequence[currentStep];

        if (step.shift_type === null || step.shift_type === 'off') {
          entries.push({
            user_id: userId,
            date,
            shift_type: null,
            team_id: teamId,
            activity_type: 'other',
            availability_status: 'unavailable',
          });
        } else {
          entries.push({
            user_id: userId,
            date,
            shift_type: step.shift_type,
            team_id: teamId,
            activity_type: 'work',
            availability_status: 'available',
          });
        }

        daysInCurrentStep++;
        if (daysInCurrentStep >= step.days) {
          currentStep = (currentStep + 1) % config.sequence.length;
          daysInCurrentStep = 0;
        }
      });
      break;
    }

    case 'weekly_pattern': {
      // E.g., Mon-Fri work, weekends off
      dates.forEach((date) => {
        const currentDate = new Date(date);
        const dayOfWeek = getDayOfWeekName(currentDate);
        const dayPattern = config.pattern[dayOfWeek];

        if (!dayPattern || dayPattern.shift_type === null) {
          entries.push({
            user_id: userId,
            date,
            shift_type: null,
            team_id: teamId,
            activity_type: 'other',
            availability_status: 'unavailable',
          });
        } else {
          entries.push({
            user_id: userId,
            date,
            shift_type: dayPattern.shift_type,
            team_id: teamId,
            activity_type: 'work',
            availability_status: 'available',
          });
        }
      });
      break;
    }

    case 'custom': {
      // Flexible day-by-day pattern
      dates.forEach((date, index) => {
        const dayInCycle = index % config.cycle_length_days;
        const dayConfig = config.days.find((d: any) => d.day === dayInCycle);

        if (!dayConfig || dayConfig.shift_type === null) {
          entries.push({
            user_id: userId,
            date,
            shift_type: null,
            team_id: teamId,
            activity_type: 'other',
            availability_status: 'unavailable',
          });
        } else {
          entries.push({
            user_id: userId,
            date,
            shift_type: dayConfig.shift_type,
            team_id: teamId,
            activity_type: 'work',
            availability_status: 'available',
          });
        }
      });
      break;
    }
  }

  return entries;
};

export const generatePatternPreview = (
  config: PatternConfig,
  days: number = 28
): Array<{ day: number; shift_type: string | null; label: string }> => {
  const preview: Array<{ day: number; shift_type: string | null; label: string }> = [];
  const startDate = new Date();

  const dates = Array.from({ length: days }, (_, i) => {
    const date = addDays(startDate, i);
    return format(date, 'yyyy-MM-dd');
  });

  const entries = applyRotationPattern(config, 'preview', 'preview', dates);

  entries.forEach((entry, index) => {
    const date = new Date(entry.date);
    preview.push({
      day: index,
      shift_type: entry.shift_type,
      label: format(date, 'EEE'),
    });
  });

  return preview;
};

export const getPatternSummary = (template: any): string => {
  const config = template.pattern_config;

  switch (config.type) {
    case 'fixed_days':
      return `${config.cycle.work_days}-on-${config.cycle.off_days}-off`;
    case 'repeating_sequence':
      return config.sequence.map((s: any) => `${s.days}${s.shift_type?.[0]?.toUpperCase() || 'O'}`).join('-');
    case 'weekly_pattern':
      return 'Weekly Pattern';
    case 'custom':
      return `${config.cycle_length_days} day cycle`;
    default:
      return 'Custom';
  }
};
