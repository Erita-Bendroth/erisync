import { useCountryShiftLimits, ShiftLimitUsage } from '@/hooks/useCountryShiftLimits';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ShiftLimitTrackerProps {
  userId: string;
  countryCode: string;
  year?: number;
  teamIds?: string[];
  compact?: boolean;
}

const SHIFT_LABELS: Record<string, string> = {
  overtime: 'Overtime Shifts',
  weekend: 'Weekend Shifts',
  holiday: 'Holiday Shifts',
  late: 'Late Shifts',
  early: 'Early Shifts',
  night: 'Night Shifts',
};

const COUNTRY_NAMES: Record<string, string> = {
  UK: 'United Kingdom',
  GB: 'United Kingdom',
  DE: 'Germany',
  BE: 'Belgium',
  FR: 'France',
  NL: 'Netherlands',
  PL: 'Poland',
  US: 'United States',
};

const FLAG_EMOJIS: Record<string, string> = {
  UK: '🇬🇧',
  GB: '🇬🇧',
  DE: '🇩🇪',
  BE: '🇧🇪',
  FR: '🇫🇷',
  NL: '🇳🇱',
  PL: '🇵🇱',
  US: '🇺🇸',
};

function LimitBar({ usage }: { usage: ShiftLimitUsage }) {
  const getProgressColor = () => {
    if (usage.isExceeded) return 'bg-destructive';
    if (usage.isNearLimit) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{SHIFT_LABELS[usage.shift_type] || usage.shift_type}</span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            {usage.used}/{usage.max_allowed}
          </span>
          {usage.isExceeded ? (
            <Badge variant="destructive" className="text-xs">
              Exceeded
            </Badge>
          ) : usage.isNearLimit ? (
            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500">
              {usage.remaining} left
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {usage.remaining} left
            </Badge>
          )}
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full ${getProgressColor()} transition-all`}
          style={{ width: `${Math.min(usage.percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function ShiftLimitTracker({
  userId,
  countryCode,
  year = new Date().getFullYear(),
  teamIds,
  compact = false,
}: ShiftLimitTrackerProps) {
  const { usage, loading, error } = useCountryShiftLimits(userId, countryCode, year, teamIds);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading shift limits...
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load shift limits: {error}</AlertDescription>
      </Alert>
    );
  }

  if (usage.length === 0) {
    if (compact) return null;
    
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No limits configured</AlertTitle>
        <AlertDescription>
          No shift limits are configured for {COUNTRY_NAMES[countryCode] || countryCode} in {year}.
        </AlertDescription>
      </Alert>
    );
  }

  const hasExceeded = usage.some((u) => u.isExceeded);
  const hasNearLimit = usage.some((u) => u.isNearLimit);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span>{FLAG_EMOJIS[countryCode] || '🌍'}</span>
          <span className="font-medium">{year} Shift Limits</span>
          {hasExceeded && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Exceeded
            </Badge>
          )}
          {!hasExceeded && hasNearLimit && (
            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500">
              Near Limit
            </Badge>
          )}
        </div>
        <div className="grid gap-2">
          {usage.map((u) => (
            <LimitBar key={u.shift_type} usage={u} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span>{FLAG_EMOJIS[countryCode] || '🌍'}</span>
          {COUNTRY_NAMES[countryCode] || countryCode} - Shift Limits {year}
        </CardTitle>
        <CardDescription>
          Tracking special shift usage against annual limits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasExceeded && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Limit Exceeded</AlertTitle>
            <AlertDescription>
              One or more shift limits have been exceeded. Review assignments to ensure compliance.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          {usage.map((u) => (
            <LimitBar key={u.shift_type} usage={u} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
