import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Users, Clock, MapPin } from "lucide-react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
}

const BulkScheduleGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [generationType, setGenerationType] = useState<"team" | "individual">("team");

  useEffect(() => {
    fetchTeams();
    // Set default dates (next 4 weeks)
    const today = new Date();
    setStartDate(today);
    setEndDate(addDays(today, 28));
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  const generateBulkSchedule = async () => {
    if (!startDate || !endDate || !selectedTeam) {
      toast({
        title: "Error",
        description: "Please select team and date range",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        'create_team_default_schedules_with_holidays',
        {
          _team_id: selectedTeam,
          _start_date: format(startDate, 'yyyy-MM-dd'),
          _end_date: format(endDate, 'yyyy-MM-dd'),
          _created_by: user.id
        }
      );

      if (error) throw error;

      const totalShifts = data?.reduce((sum: number, record: any) => sum + record.shifts_created, 0) || 0;
      const uniqueCountries = [...new Set(data?.map((record: any) => record.country_code))];

      toast({
        title: "Success",
        description: `Generated ${totalShifts} shifts for ${data?.length || 0} team members across ${uniqueCountries.length} countries. Holidays were automatically excluded.`,
      });

    } catch (error: any) {
      console.error("Error generating bulk schedule:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Bulk Schedule Generator
        </CardTitle>
        <CardDescription>
          Generate Monday-Friday 08:00-16:30 shifts automatically, excluding public holidays
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Team</label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule Pattern</label>
            <div className="p-3 border rounded-lg bg-muted/50">
              <div className="flex items-center text-sm">
                <Users className="w-4 h-4 mr-2 text-primary" />
                Monday - Friday, 08:00 - 16:30
              </div>
              <div className="flex items-center text-sm mt-1 text-muted-foreground">
                <MapPin className="w-4 h-4 mr-2" />
                Excludes holidays based on user country
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
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
                  {startDate ? format(startDate, "PPP") : "Pick start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
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
                  {endDate ? format(endDate, "PPP") : "Pick end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  disabled={(date) => startDate ? date < startDate : false}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              How it works:
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Creates shifts Monday-Friday only (skips weekends)</li>
              <li>• Uses each user's country setting to exclude their public holidays</li>
              <li>• Won't overwrite existing schedule entries</li>
              <li>• All shifts are marked as "normal" shift type with "work" activity</li>
            </ul>
          </div>

          <Button 
            onClick={generateBulkSchedule} 
            disabled={loading || !selectedTeam || !startDate || !endDate}
            className="w-full"
          >
            {loading ? "Generating Schedules..." : "Generate Schedule"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BulkScheduleGenerator;