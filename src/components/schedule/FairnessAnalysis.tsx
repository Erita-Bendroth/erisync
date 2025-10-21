import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { formatUserName } from '@/lib/utils';
import { Calendar, Moon, PartyPopper, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { ShiftCounts } from '@/hooks/useShiftCounts';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  initials?: string;
}

interface FairnessScore {
  userId: string;
  userName: string;
  pastWeekend: number;
  pastNight: number;
  pastHoliday: number;
  futureWeekend: number;
  futureNight: number;
  futureHoliday: number;
  totalWeighted: number;
  fairnessScore: number; // 0-100, where 100 is most fair (lowest burden)
  imbalanceLevel: 'low' | 'medium' | 'high';
}

interface FairnessAnalysisProps {
  teamId: string;
  userIds?: string[];
  historicalMonths?: number;
}

export const FairnessAnalysis: React.FC<FairnessAnalysisProps> = ({
  teamId,
  userIds,
  historicalMonths = 6,
}) => {
  const [loading, setLoading] = useState(true);
  const [fairnessScores, setFairnessScores] = useState<FairnessScore[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [avgScore, setAvgScore] = useState(0);
  const [imbalances, setImbalances] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (teamId) {
      fetchFairnessData();
    }
  }, [teamId, JSON.stringify(userIds), historicalMonths, refreshKey]);

  const fetchFairnessData = async () => {
    try {
      setLoading(true);
      console.log('FairnessAnalysis: Fetching data for team:', teamId, 'users:', userIds, 'months:', historicalMonths);
      
      // Fetch team members
      const { data: teamMembers, error: membersError } = await supabase
        .from('team_members')
        .select(`
          user_id,
          profiles!inner(first_name, last_name, email, initials)
        `)
        .eq('team_id', teamId);

      if (membersError) throw membersError;

      const usersData = teamMembers?.map((member: any) => ({
        id: member.user_id,
        first_name: member.profiles.first_name,
        last_name: member.profiles.last_name,
        initials: member.profiles.initials,
        email: member.profiles.email
      })) || [];

      setUsers(usersData);

      // Filter by userIds if provided
      const targetUserIds = userIds && userIds.length > 0 
        ? userIds 
        : usersData.map(u => u.id);

      // Calculate start date for historical data
      const historicalStartDate = new Date();
      historicalStartDate.setMonth(historicalStartDate.getMonth() - historicalMonths);

      // Fetch historical shift counts
      const { data: historicalData, error: historicalError } = await supabase.rpc(
        'get_user_shift_counts',
        {
          _user_ids: targetUserIds,
          _team_ids: [teamId],
          _start_date: historicalStartDate.toISOString().split('T')[0],
          _end_date: new Date().toISOString().split('T')[0],
        }
      );

      if (historicalError) throw historicalError;

      console.log('FairnessAnalysis: Historical data:', historicalData);

      // Fetch future shift counts
      const futureStartDate = new Date();
      futureStartDate.setDate(futureStartDate.getDate() + 1);
      
      const { data: futureData, error: futureError } = await supabase.rpc(
        'get_user_shift_counts',
        {
          _user_ids: targetUserIds,
          _team_ids: [teamId],
          _start_date: futureStartDate.toISOString().split('T')[0],
          _end_date: null,
        }
      );

      if (futureError) throw futureError;

      console.log('FairnessAnalysis: Future data:', futureData);

      // Create maps for easier lookup
      const historicalMap = new Map(historicalData?.map((d: any) => [d.user_id, d]) || []);
      const futureMap = new Map(futureData?.map((d: any) => [d.user_id, d]) || []);

      // Calculate fairness scores
      const scores: FairnessScore[] = targetUserIds.map(userId => {
        const user = usersData.find(u => u.id === userId);
        if (!user) return null;

        const historical = historicalMap.get(userId) || {
          weekend_shifts_count: 0,
          night_shifts_count: 0,
          holiday_shifts_count: 0,
        };

        const future = futureMap.get(userId) || {
          weekend_shifts_count: 0,
          night_shifts_count: 0,
          holiday_shifts_count: 0,
        };

        // Weighted calculation:
        // - Historical shifts: weight based on recency (more recent = higher weight)
        // - Future shifts: weight higher (1.5x) since they're upcoming commitments
        // - Different shift types have different weights:
        //   * Holiday: 3x (most burdensome)
        //   * Night: 2x (very burdensome)
        //   * Weekend: 1.5x (moderately burdensome)
        
        const historicalWeighted = 
          (historical.holiday_shifts_count * 3) +
          (historical.night_shifts_count * 2) +
          (historical.weekend_shifts_count * 1.5);

        const futureWeighted = 
          (future.holiday_shifts_count * 3 * 1.5) +
          (future.night_shifts_count * 2 * 1.5) +
          (future.weekend_shifts_count * 1.5 * 1.5);

        const totalWeighted = historicalWeighted + futureWeighted;

        return {
          userId,
          userName: formatUserName(user.first_name, user.last_name, user.initials),
          pastWeekend: historical.weekend_shifts_count,
          pastNight: historical.night_shifts_count,
          pastHoliday: historical.holiday_shifts_count,
          futureWeekend: future.weekend_shifts_count,
          futureNight: future.night_shifts_count,
          futureHoliday: future.holiday_shifts_count,
          totalWeighted,
          fairnessScore: 0, // Will be calculated after we have all scores
          imbalanceLevel: 'low',
        };
      }).filter((s): s is FairnessScore => s !== null);

      // Calculate fairness scores (inverse of burden - lower burden = higher fairness)
      if (scores.length > 0) {
        const maxWeighted = Math.max(...scores.map(s => s.totalWeighted), 1);
        const minWeighted = Math.min(...scores.map(s => s.totalWeighted));
        const range = maxWeighted - minWeighted || 1;

        scores.forEach(score => {
          // Fairness score: 100 = least burden, 0 = most burden
          score.fairnessScore = 100 - ((score.totalWeighted - minWeighted) / range * 100);
          
          // Determine imbalance level based on actual burden relative to the group
          // High burden = high imbalance (needs more fair treatment)
          // Low burden = balanced (has capacity for more shifts)
          const avgWeighted = scores.reduce((sum, s) => sum + s.totalWeighted, 0) / scores.length;
          
          // Only mark as high/medium imbalance if they have ABOVE average burden
          if (score.totalWeighted > avgWeighted) {
            const deviation = score.totalWeighted - avgWeighted;
            const deviationPercent = avgWeighted > 0 ? (deviation / avgWeighted) * 100 : 0;
            
            if (deviationPercent > 40) {
              score.imbalanceLevel = 'high';
            } else if (deviationPercent > 20) {
              score.imbalanceLevel = 'medium';
            } else {
              score.imbalanceLevel = 'low';
            }
          } else {
            // Below or equal to average burden = balanced
            score.imbalanceLevel = 'low';
          }
        });

        // Sort by fairness score (lowest first - those who need more fair treatment)
        scores.sort((a, b) => a.fairnessScore - b.fairnessScore);

        const average = scores.reduce((sum, s) => sum + s.fairnessScore, 0) / scores.length;
        setAvgScore(average);

        // Identify imbalances
        const imbalanceMessages: string[] = [];
        const highBurden = scores.filter(s => s.fairnessScore < 40);
        const lowBurden = scores.filter(s => s.fairnessScore > 80);

        if (highBurden.length > 0 && lowBurden.length > 0) {
          imbalanceMessages.push(
            `${highBurden.length} employee(s) with high burden should be prioritized for lighter shifts`
          );
          imbalanceMessages.push(
            `Consider assigning more difficult shifts to: ${lowBurden.map(s => s.userName).join(', ')}`
          );
        }

        const holidayImbalance = scores.reduce((max, s) => Math.max(max, s.pastHoliday + s.futureHoliday), 0);
        const minHoliday = scores.reduce((min, s) => Math.min(min, s.pastHoliday + s.futureHoliday), 999);
        if (holidayImbalance - minHoliday > 3) {
          imbalanceMessages.push(`Significant holiday shift imbalance detected (${holidayImbalance} vs ${minHoliday})`);
        }

        setImbalances(imbalanceMessages);
      }

      setFairnessScores(scores);
    } catch (error) {
      console.error('Error fetching fairness data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImbalanceBadge = (level: 'low' | 'medium' | 'high') => {
    if (level === 'high') {
      return <Badge variant="destructive" className="ml-2"><AlertTriangle className="h-3 w-3 mr-1" />High</Badge>;
    }
    if (level === 'medium') {
      return <Badge variant="secondary" className="ml-2"><TrendingUp className="h-3 w-3 mr-1" />Medium</Badge>;
    }
    return <Badge variant="outline" className="ml-2"><CheckCircle2 className="h-3 w-3 mr-1" />Balanced</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shift Distribution Fairness Analysis</CardTitle>
          <CardDescription>Loading comprehensive fairness data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Analyzing shift distribution...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Shift Distribution Fairness Analysis
            </CardTitle>
            <CardDescription>
              Weighted analysis of past {historicalMonths} months and all future scheduled shifts
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey(prev => prev + 1)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-primary">
              {fairnessScores.length}
            </div>
            <div className="text-xs text-muted-foreground">Employees</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-primary">
              {avgScore.toFixed(0)}
            </div>
            <div className="text-xs text-muted-foreground">Avg Fairness Score</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-primary">
              {fairnessScores.filter(s => s.imbalanceLevel === 'high').length}
            </div>
            <div className="text-xs text-muted-foreground">High Imbalances</div>
          </div>
        </div>

        {/* Imbalance Alerts */}
        {imbalances.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">Detected Imbalances:</div>
              <ul className="space-y-1 text-sm">
                {imbalances.map((msg, idx) => (
                  <li key={idx}>• {msg}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Employee Breakdown */}
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {fairnessScores.map((score, index) => (
              <div key={score.userId} className="space-y-2 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="font-semibold">{score.userName}</span>
                    {getImbalanceBadge(score.imbalanceLevel)}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{score.fairnessScore.toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground">Fairness Score</div>
                  </div>
                </div>

                {/* Progress bar */}
                <Progress value={score.fairnessScore} className="h-2" />

                {/* Shift breakdown */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground">Past {historicalMonths} Months</div>
                    <div className="flex flex-wrap gap-2">
                      {score.pastWeekend > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {score.pastWeekend} weekend
                        </Badge>
                      )}
                      {score.pastNight > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Moon className="h-3 w-3 mr-1" />
                          {score.pastNight} night
                        </Badge>
                      )}
                      {score.pastHoliday > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <PartyPopper className="h-3 w-3 mr-1" />
                          {score.pastHoliday} holiday
                        </Badge>
                      )}
                      {score.pastWeekend === 0 && score.pastNight === 0 && score.pastHoliday === 0 && (
                        <span className="text-xs text-muted-foreground">No difficult shifts</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground">Future Scheduled</div>
                    <div className="flex flex-wrap gap-2">
                      {score.futureWeekend > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {score.futureWeekend} weekend
                        </Badge>
                      )}
                      {score.futureNight > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Moon className="h-3 w-3 mr-1" />
                          {score.futureNight} night
                        </Badge>
                      )}
                      {score.futureHoliday > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <PartyPopper className="h-3 w-3 mr-1" />
                          {score.futureHoliday} holiday
                        </Badge>
                      )}
                      {score.futureWeekend === 0 && score.futureNight === 0 && score.futureHoliday === 0 && (
                        <span className="text-xs text-muted-foreground">No difficult shifts</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Weighted total */}
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  Weighted burden score: <span className="font-semibold text-foreground">{score.totalWeighted.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Recommendations */}
        {fairnessScores.length > 0 && (
          <Alert className="bg-primary/5 border-primary/20">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              <div className="font-semibold mb-2 text-primary">Recommendations:</div>
              <ul className="space-y-1 text-sm">
                {fairnessScores[0] && fairnessScores[0].fairnessScore < 50 && (
                  <li>• Prioritize <strong>{fairnessScores[0].userName}</strong> for standard weekday shifts</li>
                )}
                {fairnessScores[fairnessScores.length - 1] && fairnessScores[fairnessScores.length - 1].fairnessScore > 70 && (
                  <li>• Consider assigning more weekend/night shifts to <strong>{fairnessScores[fairnessScores.length - 1].userName}</strong></li>
                )}
                <li>• Enable Fairness Mode when generating schedules to automatically balance shift distribution</li>
                <li>• Review and adjust assignments every {Math.ceil(historicalMonths / 2)} months to maintain balance</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
