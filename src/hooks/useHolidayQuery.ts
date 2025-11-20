import { useQuery } from '@tanstack/react-query';
import { detectHolidays, HolidayInfo } from '@/lib/holidayDetection';

interface UseHolidayQueryParams {
  dates: Date[];
  userIds: string[];
  teamId: string;
  enabled?: boolean;
}

/**
 * Hook to query holidays with React Query caching
 * Automatically refetches when cache is invalidated
 */
export function useHolidayQuery({ dates, userIds, teamId, enabled = true }: UseHolidayQueryParams) {
  return useQuery({
    queryKey: ['holidays', {
      dateRange: dates.length > 0 ? {
        start: dates[0].toISOString(),
        end: dates[dates.length - 1].toISOString()
      } : null,
      userIds: userIds.sort(),
      teamId
    }],
    queryFn: () => detectHolidays(dates, userIds, teamId),
    enabled: enabled && dates.length > 0 && userIds.length > 0 && !!teamId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}
