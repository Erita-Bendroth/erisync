import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, CalendarIcon, Users, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  min_staff_required: number;
  eligible_count: number;
  weekday_start: string;
  weekday_end: string;
  friday_start: string;
  friday_end: string;
}

interface HotlineQuickPanelProps {
  onGenerate: (teamIds: string[], startDate: Date, endDate: Date) => void;
  loading?: boolean;
}

export const HotlineQuickPanel = ({ onGenerate, loading }: HotlineQuickPanelProps) => {
  const [configuredTeams, setConfiguredTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    fetchConfiguredTeams();
  }, []);

  const fetchConfiguredTeams = async () => {
    try {
      // Get teams with hotline config
      const { data: configs } = await supabase
        .from('hotline_team_config')
        .select(`
          team_id,
          min_staff_required,
          weekday_start_time,
          weekday_end_time,
          friday_start_time,
          friday_end_time,
          teams!inner(id, name)
        `);

      if (configs) {
        // For each team, count eligible members
        const teamsWithCounts = await Promise.all(
          configs.map(async (config: any) => {
            const { count } = await supabase
              .from('hotline_eligible_members')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', config.team_id)
              .eq('is_active', true);

            return {
              id: config.team_id,
              name: config.teams.name,
              min_staff_required: config.min_staff_required || 1,
              eligible_count: count || 0,
              weekday_start: config.weekday_start_time || '08:00',
              weekday_end: config.weekday_end_time || '17:00',
              friday_start: config.friday_start_time || '08:00',
              friday_end: config.friday_end_time || '14:00',
            };
          })
        );

        setConfiguredTeams(teamsWithCounts);
      }
    } catch (error) {
      console.error('Error fetching configured teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleGenerate = () => {
    if (selectedTeams.length > 0 && startDate && endDate) {
      onGenerate(selectedTeams, startDate, endDate);
    }
  };

  const canGenerate = selectedTeams.length > 0 && startDate && endDate;

  if (loadingTeams) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">Loading hotline configurations...</div>
      </Card>
    );
  }

  if (configuredTeams.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No teams have hotline configured yet. Go to the Teams tab to configure hotline settings for your teams.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Selection */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Select Teams for Hotline</h3>
          </div>

          <div className="space-y-3">
            {configuredTeams.map(team => (
              <div
                key={team.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedTeams.includes(team.id)}
                    onCheckedChange={() => toggleTeam(team.id)}
                  />
                  <div>
                    <div className="font-medium">{team.name}</div>
                    <div className="text-sm text-muted-foreground">
                      <Users className="h-3 w-3 inline mr-1" />
                      {team.eligible_count} eligible members
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {team.min_staff_required} staff/day
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Mon-Thu: {team.weekday_start}-{team.weekday_end}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Fri: {team.friday_start}-{team.friday_end}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {selectedTeams.length > 0 && (
            <Alert>
              <AlertDescription>
                {selectedTeams.length} team{selectedTeams.length !== 1 ? 's' : ''} selected
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      {/* Date Range */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Select Date Range</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </Card>

      {/* Generate Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
          className="gap-2"
        >
          <Phone className="h-4 w-4" />
          Generate Hotline Schedule
        </Button>
      </div>
    </div>
  );
};
