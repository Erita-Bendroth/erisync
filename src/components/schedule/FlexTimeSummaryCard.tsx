import { Card, CardContent } from "@/components/ui/card";
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatFlexHours } from "@/lib/flexTimeUtils";
import { cn } from "@/lib/utils";

interface FlexTimeSummaryCardProps {
  previousBalance: number;
  currentMonthDelta: number;
  currentBalance: number;
  loading?: boolean;
}

export function FlexTimeSummaryCard({
  previousBalance,
  currentMonthDelta,
  currentBalance,
  loading = false,
}: FlexTimeSummaryCardProps) {
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
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-primary" />
          <span className="font-semibold">FlexTime Balance</span>
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

          {/* This Month Change */}
          <div className="space-y-1">
            <div className={cn(
              "text-xl font-bold flex items-center justify-center gap-1",
              getValueColor(currentMonthDelta)
            )}>
              {getTrendIcon(currentMonthDelta)}
              {formatFlexHours(currentMonthDelta)}
            </div>
            <div className="text-xs text-muted-foreground">This Month</div>
          </div>

          {/* Current Balance */}
          <div className="space-y-1 bg-background/50 rounded-lg p-2 -m-1">
            <div className={cn(
              "text-xl font-bold flex items-center justify-center gap-1",
              getValueColor(currentBalance)
            )}>
              {getTrendIcon(currentBalance)}
              {formatFlexHours(currentBalance)}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Current Balance</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
