import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, TrendingDown, Minus, Settings, AlertTriangle, Home } from "lucide-react";
import { formatFlexHours } from "@/lib/flexTimeUtils";
import { cn } from "@/lib/utils";
import { FlexTimeExportDialog } from "./FlexTimeExportDialog";
import { FlexTimeSettingsDialog } from "./FlexTimeSettingsDialog";
import type { DailyTimeEntry, MonthlyFlexSummary } from "@/hooks/useTimeEntries";
import { useHomeOfficeCompliance } from "@/hooks/useHomeOfficeCompliance";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FlexTimeSummaryCardProps {
  previousBalance: number;
  currentMonthDelta: number;
  currentBalance: number;
  carryoverLimit: number;
  entries: DailyTimeEntry[];
  monthlySummary: MonthlyFlexSummary | null;
  monthDate: Date;
  userName: string;
  onSaveCarryoverLimit: (limit: number) => Promise<boolean>;
  loading?: boolean;
}

export function FlexTimeSummaryCard({
  previousBalance,
  currentMonthDelta,
  currentBalance,
  carryoverLimit,
  entries,
  monthlySummary,
  monthDate,
  userName,
  onSaveCarryoverLimit,
  loading = false,
}: FlexTimeSummaryCardProps) {
  const { user } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Fetch Home Office compliance for the current user
  const { compliance: hoCompliance } = useHomeOfficeCompliance({
    userId: user?.id || '',
    referenceDate: monthDate,
  });
  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4" />;
    if (value < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getValueColor = (value: number) => {
    if (value > 0) return "text-green-600 dark:text-green-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  // Calculate limit status
  const absBalance = Math.abs(currentBalance);
  const limitPercentage = carryoverLimit > 0 ? (absBalance / carryoverLimit) * 100 : 0;
  const isOverLimit = absBalance > carryoverLimit;
  const isApproachingLimit = limitPercentage >= 80 && !isOverLimit;

  // Calculate FZA breakdown
  const fzaTotalHours = entries
    .filter(e => e.entry_type === 'fza_withdrawal')
    .reduce((sum, e) => sum + (e.fza_hours || 0), 0);
  
  const pureFlexDelta = entries
    .filter(e => e.entry_type !== 'fza_withdrawal')
    .reduce((sum, e) => sum + (e.flextime_delta || 0), 0);

  const getLimitBadge = () => {
    if (isOverLimit) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          Over Limit
        </Badge>
      );
    }
    if (isApproachingLimit) {
      return (
        <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          <AlertTriangle className="w-3 h-3" />
          {Math.round(limitPercentage)}% of Limit
        </Badge>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-semibold">FlexTime Balance</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center animate-pulse">
            <div className="space-y-1">
              <div className="h-6 bg-muted rounded w-16 mx-auto" />
              <div className="h-3 bg-muted rounded w-20 mx-auto" />
            </div>
            <div className="space-y-1">
              <div className="h-6 bg-muted rounded w-16 mx-auto" />
              <div className="h-3 bg-muted rounded w-20 mx-auto" />
            </div>
            <div className="space-y-1">
              <div className="h-6 bg-muted rounded w-16 mx-auto" />
              <div className="h-3 bg-muted rounded w-20 mx-auto" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span className="font-semibold">FlexTime Balance</span>
              {getLimitBadge()}
            </div>
            <div className="flex items-center gap-2">
              <FlexTimeExportDialog
                currentMonthDate={monthDate}
                userName={userName}
                carryoverLimit={carryoverLimit}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>FlexTime Settings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            {/* Previous Balance */}
            <div className="space-y-1">
              <div className={cn(
                "text-xl font-bold flex items-center justify-center gap-1",
                getValueColor(previousBalance)
              )}>
                {getTrendIcon(previousBalance)}
                {formatFlexHours(previousBalance)}
              </div>
              <div className="text-xs text-muted-foreground">Previous Balance</div>
            </div>

            {/* This Month Change with breakdown */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="space-y-1 cursor-help">
                    <div className={cn(
                      "text-xl font-bold flex items-center justify-center gap-1",
                      getValueColor(currentMonthDelta)
                    )}>
                      {getTrendIcon(currentMonthDelta)}
                      {formatFlexHours(currentMonthDelta)}
                    </div>
                    <div className="text-xs text-muted-foreground">This Month</div>
                    {(fzaTotalHours > 0 || Math.abs(pureFlexDelta) > 0) && (
                      <div className="text-[10px] text-muted-foreground space-x-2">
                        <span className={pureFlexDelta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          FLEX: {formatFlexHours(pureFlexDelta)}
                        </span>
                        {fzaTotalHours > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            FZA: -{fzaTotalHours.toFixed(1)}h
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1 text-xs">
                    <p><strong>FLEX earned:</strong> {formatFlexHours(pureFlexDelta)}</p>
                    <p><strong>FZA taken:</strong> {fzaTotalHours > 0 ? `-${fzaTotalHours.toFixed(2)}h` : "0.00h"}</p>
                    <p className="text-muted-foreground mt-1">Net: {formatFlexHours(currentMonthDelta)}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Current Balance */}
            <div className={cn(
              "space-y-1 rounded-lg p-2 -m-1",
              isOverLimit 
                ? "bg-destructive/10" 
                : isApproachingLimit 
                  ? "bg-yellow-100/50 dark:bg-yellow-900/20"
                  : "bg-background/50"
            )}>
              <div className={cn(
                "text-xl font-bold flex items-center justify-center gap-1",
                isOverLimit 
                  ? "text-destructive"
                  : getValueColor(currentBalance)
              )}>
                {getTrendIcon(currentBalance)}
                {formatFlexHours(currentBalance)}
              </div>
              <div className="text-xs text-muted-foreground font-medium">Current Balance</div>
              <div className="text-[10px] text-muted-foreground">
                Limit: {formatFlexHours(carryoverLimit)}
              </div>
            </div>
          </div>

          {/* Home Office Section */}
          {hoCompliance && hoCompliance.limitType !== 'none' && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium">Home Office</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-semibold",
                    hoCompliance.isOverLimit 
                      ? "text-destructive" 
                      : hoCompliance.isApproachingLimit 
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-foreground"
                  )}>
                    {hoCompliance.currentPeriodDays}/{hoCompliance.maxDays} days this {hoCompliance.limitType === 'weekly' ? 'week' : hoCompliance.limitType === 'monthly' ? 'month' : 'year'}
                  </span>
                  {hoCompliance.isOverLimit ? (
                    <Badge variant="destructive" className="text-xs">Over limit</Badge>
                  ) : hoCompliance.isApproachingLimit ? (
                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                      {Math.round(hoCompliance.percentUsed)}%
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      OK
                    </Badge>
                  )}
                </div>
              </div>
              {hoCompliance.limitType !== 'yearly' && (
                <div className="text-xs text-muted-foreground mt-1 text-right">
                  {hoCompliance.yearToDateDays} days YTD
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <FlexTimeSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentLimit={carryoverLimit}
        onSave={onSaveCarryoverLimit}
      />
    </>
  );
}
