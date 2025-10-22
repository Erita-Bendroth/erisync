import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { Users, Save, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Team {
  id: string;
  name: string;
}

interface CapacityConfig {
  id?: string;
  team_id: string;
  min_staff_required: number;
  max_staff_allowed: number | null;
  applies_to_weekends: boolean;
  notes: string;
}

export const TeamCapacityConfig = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [config, setConfig] = useState<CapacityConfig>({
    team_id: '',
    min_staff_required: 1,
    max_staff_allowed: null,
    applies_to_weekends: false,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAccessibleTeams();
  }, [user]);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamConfig(selectedTeamId);
    }
  }, [selectedTeamId]);

  const fetchAccessibleTeams = async () => {
    try {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

      const roles = rolesData?.map(r => r.role) || [];
      const isAdmin = roles.includes('admin');
      const isPlanner = roles.includes('planner');
      const isManager = roles.includes('manager');

      if (isAdmin || isPlanner) {
        const { data: teamsData, error } = await supabase
          .from('teams')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setTeams(teamsData || []);
      } else if (isManager) {
        const { data: managedTeamsData, error } = await supabase
          .rpc('get_manager_accessible_teams', { _manager_id: user?.id });

        if (error) throw error;

        if (managedTeamsData && managedTeamsData.length > 0) {
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', managedTeamsData)
            .order('name');

          if (teamsError) throw teamsError;
          setTeams(teamsData || []);
        }
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: 'Error',
        description: 'Failed to load teams',
        variant: 'destructive'
      });
    }
  };

  const fetchTeamConfig = async (teamId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_capacity_config')
        .select('*')
        .eq('team_id', teamId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setConfig({
          id: data.id,
          team_id: data.team_id,
          min_staff_required: data.min_staff_required,
          max_staff_allowed: data.max_staff_allowed,
          applies_to_weekends: data.applies_to_weekends,
          notes: data.notes || ''
        });
      } else {
        // No config exists, set defaults
        setConfig({
          team_id: teamId,
          min_staff_required: 1,
          max_staff_allowed: null,
          applies_to_weekends: false,
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error fetching team config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTeamId) {
      toast({
        title: 'Error',
        description: 'Please select a team',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const saveData = {
        team_id: selectedTeamId,
        min_staff_required: config.min_staff_required,
        max_staff_allowed: config.max_staff_allowed,
        applies_to_weekends: config.applies_to_weekends,
        notes: config.notes,
        created_by: user?.id
      };

      if (config.id) {
        // Update existing
        const { error } = await supabase
          .from('team_capacity_config')
          .update(saveData)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('team_capacity_config')
          .insert(saveData);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Team capacity configuration saved successfully'
      });

      // Refresh config
      fetchTeamConfig(selectedTeamId);
    } catch (error: any) {
      console.error('Error saving team config:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Capacity Configuration
        </CardTitle>
        <CardDescription>
          Set minimum and maximum staff requirements for each team to enable accurate coverage gap detection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            These settings determine how coverage gaps are calculated in the analytics dashboard.
            The utilization rate now correctly accounts for business days only (Mon-Fri, excluding holidays).
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-select">Select Team</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger id="team-select">
                <SelectValue placeholder="Choose a team..." />
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

          {selectedTeamId && !loading && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-staff">Minimum Staff Required *</Label>
                  <Input
                    id="min-staff"
                    type="number"
                    min="1"
                    value={config.min_staff_required}
                    onChange={(e) => setConfig({ ...config, min_staff_required: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum number of people needed per day
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-staff">Maximum Staff Allowed (Optional)</Label>
                  <Input
                    id="max-staff"
                    type="number"
                    min="1"
                    value={config.max_staff_allowed || ''}
                    onChange={(e) => setConfig({ ...config, max_staff_allowed: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="No limit"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for no upper limit
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="weekends"
                  checked={config.applies_to_weekends}
                  onCheckedChange={(checked) => setConfig({ ...config, applies_to_weekends: checked })}
                />
                <Label htmlFor="weekends" className="cursor-pointer">
                  Apply requirements to weekends
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={config.notes}
                  onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                  placeholder="Additional notes about this team's capacity requirements..."
                  rows={3}
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
