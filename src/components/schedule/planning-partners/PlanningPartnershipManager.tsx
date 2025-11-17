import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Users } from 'lucide-react';
import { MultiSelectTeams } from '@/components/ui/multi-select-teams';

interface PlanningPartnership {
  id: string;
  partnership_name: string;
  team_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
}

export function PlanningPartnershipManager() {
  const { user } = useAuth();
  const [partnerships, setPartnerships] = useState<PlanningPartnership[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [partnershipName, setPartnershipName] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchPartnerships();
      fetchTeams();
    }
  }, [user]);

  const fetchPartnerships = async () => {
    try {
      const { data, error } = await supabase
        .from('team_planning_partners')
        .select('*')
        .order('partnership_name');

      if (error) throw error;
      setPartnerships(data || []);
    } catch (error) {
      console.error('Error fetching partnerships:', error);
      toast.error('Failed to load planning partnerships');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const handleCreatePartnership = async () => {
    if (!partnershipName.trim()) {
      toast.error('Please enter a partnership name');
      return;
    }

    if (selectedTeamIds.length < 2) {
      toast.error('Please select at least 2 teams');
      return;
    }

    try {
      const { error } = await supabase
        .from('team_planning_partners')
        .insert({
          partnership_name: partnershipName,
          team_ids: selectedTeamIds,
          created_by: user!.id,
        });

      if (error) throw error;

      toast.success('Planning partnership created successfully');
      setDialogOpen(false);
      setPartnershipName('');
      setSelectedTeamIds([]);
      fetchPartnerships();
    } catch (error: any) {
      console.error('Error creating partnership:', error);
      toast.error(error.message || 'Failed to create planning partnership');
    }
  };

  const handleDeletePartnership = async (partnershipId: string) => {
    if (!confirm('Are you sure you want to delete this planning partnership?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('team_planning_partners')
        .delete()
        .eq('id', partnershipId);

      if (error) throw error;

      toast.success('Planning partnership deleted successfully');
      fetchPartnerships();
    } catch (error: any) {
      console.error('Error deleting partnership:', error);
      toast.error(error.message || 'Failed to delete planning partnership');
    }
  };

  const getTeamNames = (teamIds: string[]) => {
    return teamIds
      .map(id => teams.find(t => t.id === id)?.name || 'Unknown Team')
      .join(', ');
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading planning partnerships...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Planning Partnerships</h2>
          <p className="text-muted-foreground">
            Enable teams to co-plan schedules while maintaining privacy
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Partnership
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Planning Partnership</DialogTitle>
              <DialogDescription>
                Create a partnership between teams to enable shared schedule planning
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="partnership-name">Partnership Name</Label>
                <Input
                  id="partnership-name"
                  placeholder="e.g., Troubleshooting North Co-Planning"
                  value={partnershipName}
                  onChange={(e) => setPartnershipName(e.target.value)}
                />
              </div>
              <div>
                <Label>Select Teams (minimum 2)</Label>
                <MultiSelectTeams
                  teams={teams}
                  selectedTeamIds={selectedTeamIds}
                  onValueChange={setSelectedTeamIds}
                  placeholder="Select teams for this partnership"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePartnership}>
                Create Partnership
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {partnerships.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No planning partnerships created yet</p>
            <p className="text-sm mt-2">
              Create partnerships to enable teams to co-plan their schedules
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {partnerships.map((partnership) => (
            <Card key={partnership.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{partnership.partnership_name}</CardTitle>
                    <CardDescription>
                      {partnership.team_ids.length} teams collaborating
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeletePartnership(partnership.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  <strong>Teams:</strong> {getTeamNames(partnership.team_ids)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
