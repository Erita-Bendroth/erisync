import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeSelect } from "@/components/ui/time-select";
import { MultiSelectDays } from "@/components/ui/multi-select-days";
import { MultiSelectTeams } from "@/components/ui/multi-select-teams";
import { Plus, Trash2, Save, Users } from "lucide-react";
import { ShiftTimeDefinition } from "@/lib/shiftTimeUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const REGIONS = ["DE", "UK", "SE", "FR", "CH", "AT"];

export function ShiftTimeDefinitions() {
  const [definitions, setDefinitions] = useState<ShiftTimeDefinition[]>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeams();
    fetchDefinitions();
  }, []);

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("id, name").order("name");
    if (data) setTeams(data);
  };

  const fetchDefinitions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shift_time_definitions")
      .select("*")
      .order("shift_type");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch shift time definitions",
        variant: "destructive",
      });
    } else {
      setDefinitions(data || []);
    }
    setLoading(false);
  };

  const addDefinition = () => {
    const newDef: ShiftTimeDefinition = {
      id: `temp-${crypto.randomUUID()}`,
      team_id: null,
      team_ids: null,
      region_code: null,
      shift_type: "normal",
      day_of_week: null,
      start_time: "08:00",
      end_time: "16:30",
      description: "",
    };
    setDefinitions([...definitions, newDef]);
  };

  const updateDefinition = (index: number, field: string, value: any) => {
    const updated = [...definitions];
    updated[index] = { ...updated[index], [field]: value };
    setDefinitions(updated);
  };

  const saveDefinition = async (def: ShiftTimeDefinition, index: number) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    // Prepare base data
    const baseData = {
      created_by: user.user.id,
      team_id: null,
      team_ids: def.team_ids && def.team_ids.length > 0 ? def.team_ids : null,
      region_code: def.region_code || null,
      day_of_week: def.day_of_week,
      shift_type: def.shift_type,
      start_time: def.start_time,
      end_time: def.end_time,
      description: def.description,
    };

    // Only UPDATE if this is a saved definition (not a temp ID)
    if (def.id && !def.id.startsWith('temp-')) {
      const saveData = { ...baseData, id: def.id };
      const { error } = await supabase
        .from("shift_time_definitions")
        .update(saveData)
        .eq("id", def.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update definition",
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: "Shift time updated" });
      }
    } else {
      // For new definitions, don't include the temp ID - let database generate UUID
      const { data, error } = await supabase
        .from("shift_time_definitions")
        .insert(baseData)
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create definition",
          variant: "destructive",
        });
      } else {
        const updated = [...definitions];
        updated[index] = data;
        setDefinitions(updated);
        toast({ title: "Success", description: "Shift time created" });
      }
    }
  };

  const deleteDefinition = async (def: ShiftTimeDefinition, index: number) => {
    // Only attempt database deletion if this is a saved definition (not a temp ID)
    if (def.id && !def.id.startsWith('temp-')) {
      const { error } = await supabase
        .from("shift_time_definitions")
        .delete()
        .eq("id", def.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete definition",
          variant: "destructive",
        });
        return;
      }
    }

    const updated = definitions.filter((_, i) => i !== index);
    setDefinitions(updated);
    toast({ title: "Success", description: "Shift time deleted" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shift Time Definitions</CardTitle>
        <CardDescription>
          Configure shift times per team, region, or day. More specific rules override general ones.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button onClick={addDefinition} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Override
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Shift Type</TableHead>
                <TableHead className="w-[100px]">Teams</TableHead>
                <TableHead className="w-[100px]">Region</TableHead>
                <TableHead className="w-[140px]">Day</TableHead>
                <TableHead className="w-[110px]">Start</TableHead>
                <TableHead className="w-[110px]">End</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {definitions.map((def, index) => (
                <TableRow key={def.id || index}>
                  <TableCell>
                    <Select
                      value={def.shift_type}
                      onValueChange={(value) =>
                        updateDefinition(index, "shift_type", value)
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="early">Early</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="weekend">Weekend / National Holiday</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {def.team_ids && def.team_ids.length > 0 ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-full justify-start"
                          >
                            <Users className="w-4 h-4 mr-2" />
                            {def.team_ids.length} team{def.team_ids.length !== 1 ? 's' : ''}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px]" align="start">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Selected Teams</p>
                            <div className="flex flex-wrap gap-1">
                              {def.team_ids.map((teamId) => {
                                const team = teams.find(t => t.id === teamId);
                                return team ? (
                                  <Badge key={teamId} variant="secondary" className="text-xs">
                                    {team.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                            <MultiSelectTeams
                              teams={teams}
                              selectedTeamIds={def.team_ids}
                              onValueChange={(value) =>
                                updateDefinition(index, "team_ids", value.length > 0 ? value : null)
                              }
                              placeholder="Select teams"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-full justify-start text-muted-foreground"
                          >
                            All Teams
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px]" align="start">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Select Teams</p>
                            <p className="text-xs text-muted-foreground">
                              No teams selected = applies to all teams globally
                            </p>
                            <MultiSelectTeams
                              teams={teams}
                              selectedTeamIds={[]}
                              onValueChange={(value) =>
                                updateDefinition(index, "team_ids", value.length > 0 ? value : null)
                              }
                              placeholder="Select teams"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={def.region_code || "none"}
                      onValueChange={(value) =>
                        updateDefinition(
                          index,
                          "region_code",
                          value === "none" ? null : value
                        )
                      }
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All</SelectItem>
                        {REGIONS.map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {def.shift_type === 'weekend' ? (
                      <div className="text-sm text-muted-foreground italic px-2">
                        Auto: Sat, Sun & holidays
                      </div>
                    ) : (
                      <MultiSelectDays
                        value={def.day_of_week as number[] | null}
                        onValueChange={(value) =>
                          updateDefinition(index, "day_of_week", value)
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <TimeSelect
                      value={def.start_time}
                      onValueChange={(value) =>
                        updateDefinition(index, "start_time", value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TimeSelect
                      value={def.end_time}
                      onValueChange={(value) =>
                        updateDefinition(index, "end_time", value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={def.description || ""}
                      onChange={(e) =>
                        updateDefinition(index, "description", e.target.value)
                      }
                      placeholder="Description"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveDefinition(def, index)}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteDefinition(def, index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {definitions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No shift time definitions. Click "Add Override" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
