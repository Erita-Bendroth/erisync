import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoverageImpactPreviewProps {
  swapDate: string;
  teamId: string;
  requestingUserId: string;
  targetUserId: string;
  requestingShiftType?: string;
  targetShiftType?: string;
}

interface CoverageData {
  date: string;
  shiftType: string;
  currentStaff: number;
  afterSwapStaff: number;
  requiredStaff: number;
}

export function CoverageImpactPreview({
  swapDate,
  teamId,
  requestingUserId,
  targetUserId,
  requestingShiftType,
  targetShiftType,
}: CoverageImpactPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [coverageData, setCoverageData] = useState<CoverageData[]>([]);
  const [hasWarning, setHasWarning] = useState(false);

  useEffect(() => {
    analyzeCoverageImpact();
  }, [swapDate, teamId, requestingUserId, targetUserId]);

  const analyzeCoverageImpact = async () => {
    setLoading(true);
    try {
      // Get all schedule entries for the swap date in this team
      const { data: entries } = await supabase
        .from('schedule_entries')
        .select('user_id, shift_type, availability_status')
        .eq('team_id', teamId)
        .eq('date', swapDate)
        .eq('availability_status', 'available');

      // Get team capacity requirements
      const { data: capacityConfig } = await supabase
        .from('team_capacity_config')
        .select('min_staff_required')
        .eq('team_id', teamId)
        .single();

      const minRequired = capacityConfig?.min_staff_required || 1;

      // Group by shift type
      const shiftGroups: Record<string, string[]> = {};
      (entries || []).forEach(entry => {
        const type = entry.shift_type || 'normal';
        if (!shiftGroups[type]) shiftGroups[type] = [];
        shiftGroups[type].push(entry.user_id);
      });

      // Analyze impact for relevant shift types
      const relevantShifts = new Set([
        targetShiftType || 'normal',
        requestingShiftType || 'normal',
      ]);

      const coverageResults: CoverageData[] = [];
      let hasAnyWarning = false;

      relevantShifts.forEach(shiftType => {
        const currentStaffList = shiftGroups[shiftType] || [];
        const currentStaff = currentStaffList.length;

        // Calculate after-swap staff
        // If same shift type, it's a straight swap - no change
        // If different shift types, we need to account for movements
        let afterSwapStaff = currentStaff;

        if (shiftType === targetShiftType) {
          // Target shift: loses the target user (they're giving away this shift)
          // But gains requesting user (they're taking this shift)
          // Net effect: 0 if it's a true swap
          if (requestingShiftType !== targetShiftType) {
            // Cross-type swap: target type gains the requesting user
            afterSwapStaff = currentStaff; // No net change for target shift type
          }
        }

        if (shiftType === requestingShiftType && requestingShiftType !== targetShiftType) {
          // The requesting user's original shift type loses them
          afterSwapStaff = Math.max(0, currentStaff - 1);
        }

        const isUnderStaffed = afterSwapStaff < minRequired;
        if (isUnderStaffed) hasAnyWarning = true;

        coverageResults.push({
          date: swapDate,
          shiftType,
          currentStaff,
          afterSwapStaff,
          requiredStaff: minRequired,
        });
      });

      setCoverageData(coverageResults);
      setHasWarning(hasAnyWarning);
    } catch (error) {
      console.error('Error analyzing coverage impact:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (coverageData.length === 0) {
    return null;
  }

  return (
    <Card className={cn(hasWarning && 'border-yellow-500/50')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Coverage Impact
          {hasWarning ? (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200 ml-auto">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Review Needed
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 ml-auto">
              <CheckCircle className="h-3 w-3 mr-1" />
              No Issues
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <p className="text-xs text-muted-foreground mb-3">
          {format(new Date(swapDate), 'EEEE, MMMM d, yyyy')}
        </p>

        <div className="space-y-2">
          {coverageData.map((data, idx) => {
            const isUnderStaffed = data.afterSwapStaff < data.requiredStaff;
            const noChange = data.currentStaff === data.afterSwapStaff;

            return (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground capitalize">{data.shiftType} Shift:</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'font-medium',
                    data.currentStaff < data.requiredStaff && 'text-yellow-600'
                  )}>
                    {data.currentStaff}
                  </span>
                  {!noChange && (
                    <>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className={cn(
                        'font-medium',
                        isUnderStaffed ? 'text-red-600' : 'text-green-600'
                      )}>
                        {data.afterSwapStaff}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground">
                    / {data.requiredStaff} required
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {hasWarning && (
          <Alert variant="destructive" className="mt-3 py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Approving this swap may leave the team understaffed. Consider the impact before approving.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
