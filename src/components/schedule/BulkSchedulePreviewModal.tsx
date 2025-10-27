import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, Calendar, Moon, PartyPopper, TrendingUp, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PreviewEntry {
  user_id: string;
  user_name: string;
  date: string;
  shift_type: string;
  activity_type: string;
}

interface CoverageGap {
  date: string;
  teamName: string;
  required: number;
  actual: number;
  deficit: number;
  isWeekend: boolean;
  isHoliday: boolean;
}

interface PreviewData {
  entries: PreviewEntry[];
  coveragePercentage: number;
  gaps: CoverageGap[];
  fairnessScore: number;
  totalDays: number;
  coveredDays: number;
  threshold: number;
  weekendShifts: number;
  nightShifts: number;
  holidayShifts: number;
}

interface BulkSchedulePreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRegenerate: () => void;
  previewData: PreviewData | null;
  loading?: boolean;
}

export function BulkSchedulePreviewModal({
  open,
  onClose,
  onConfirm,
  onRegenerate,
  previewData,
  loading = false,
}: BulkSchedulePreviewModalProps) {
  if (!previewData) return null;

  const { 
    coveragePercentage, 
    gaps, 
    fairnessScore, 
    totalDays, 
    coveredDays,
    threshold,
    weekendShifts,
    nightShifts,
    holidayShifts,
    entries
  } = previewData;

  const belowThreshold = coveragePercentage < threshold;
  const criticalGaps = gaps.filter(g => g.deficit >= 2);
  const warningGaps = gaps.filter(g => g.deficit === 1);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Generation Preview
          </DialogTitle>
          <DialogDescription>
            Review the generated schedule before confirming
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Coverage Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Coverage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{coveragePercentage}%</span>
                    <Badge variant={belowThreshold ? "destructive" : "default"}>
                      {belowThreshold ? "Below Threshold" : "Good"}
                    </Badge>
                  </div>
                  <Progress value={coveragePercentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {coveredDays} of {totalDays} days covered
                  </p>
                </CardContent>
              </Card>

              {/* Fairness Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Fairness Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{Math.round(fairnessScore)}/100</span>
                    <Badge
                      variant={fairnessScore >= 70 ? "default" : fairnessScore >= 50 ? "secondary" : "destructive"}
                    >
                      {fairnessScore >= 70 ? "Balanced" : fairnessScore >= 50 ? "Fair" : "Imbalanced"}
                    </Badge>
                  </div>
                  <Progress value={fairnessScore} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Shift distribution balance
                  </p>
                </CardContent>
              </Card>

              {/* Shift Distribution Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Shift Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <PartyPopper className="h-3 w-3 text-purple-500" />
                        Holiday
                      </span>
                      <span className="font-medium">{holidayShifts}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-blue-500" />
                        Weekend
                      </span>
                      <span className="font-medium">{weekendShifts}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Moon className="h-3 w-3 text-indigo-500" />
                        Night
                      </span>
                      <span className="font-medium">{nightShifts}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alerts */}
            {belowThreshold && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Coverage is below the {threshold}% threshold. Consider regenerating with adjusted parameters.
                </AlertDescription>
              </Alert>
            )}

            {gaps.length === 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  All shifts are fully covered with no gaps!
                </AlertDescription>
              </Alert>
            )}

            {/* Coverage Gaps */}
            {gaps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Coverage Gaps ({gaps.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {criticalGaps.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-destructive mb-2">
                          Critical (Missing 2+ staff):
                        </p>
                        <div className="space-y-1">
                          {criticalGaps.slice(0, 5).map((gap, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs p-2 rounded bg-destructive/10"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {format(new Date(gap.date), "EEE, MMM d")}
                                </span>
                                <span className="text-muted-foreground">{gap.teamName}</span>
                                {gap.isHoliday && <PartyPopper className="h-3 w-3 text-purple-500" />}
                                {gap.isWeekend && <Calendar className="h-3 w-3 text-blue-500" />}
                              </div>
                              <Badge variant="destructive" className="text-xs">
                                Need {gap.deficit} more
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {warningGaps.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-500 mb-2">
                          Warning (Missing 1 staff):
                        </p>
                        <div className="space-y-1">
                          {warningGaps.slice(0, 5).map((gap, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs p-2 rounded bg-yellow-500/10"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {format(new Date(gap.date), "EEE, MMM d")}
                                </span>
                                <span className="text-muted-foreground">{gap.teamName}</span>
                                {gap.isHoliday && <PartyPopper className="h-3 w-3 text-purple-500" />}
                                {gap.isWeekend && <Calendar className="h-3 w-3 text-blue-500" />}
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                Need 1 more
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {gaps.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        ... and {gaps.length - 10} more gaps
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preview Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Generation Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Entries:</span>
                    <span className="font-medium">{entries.length}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unique Users:</span>
                    <span className="font-medium">
                      {new Set(entries.map(e => e.user_id)).size}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date Range:</span>
                    <span className="font-medium">
                      {entries.length > 0 && (
                        <>
                          {format(new Date(Math.min(...entries.map(e => new Date(e.date).getTime()))), "MMM d")}
                          {" - "}
                          {format(new Date(Math.max(...entries.map(e => new Date(e.date).getTime()))), "MMM d, yyyy")}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onRegenerate} disabled={loading}>
              <Loader2 className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Regenerate
            </Button>
            <Button onClick={onConfirm} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm & Save
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
