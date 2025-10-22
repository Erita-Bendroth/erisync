import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Users } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

interface TeamCapacityConfigProps {
  teamId: string;
  teamName: string;
}

export const TeamCapacityConfig = ({ teamId, teamName }: TeamCapacityConfigProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    min_staff_required: 1,
    max_staff_allowed: null as number | null,
    applies_to_weekends: false,
    notes: ''
  });
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, [teamId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_capacity_config')
        .select('*')
        .eq('team_id', teamId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfigId(data.id);
        setConfig({
          min_staff_required: data.min_staff_required,
          max_staff_allowed: data.max_staff_allowed,
          applies_to_weekends: data.applies_to_weekends,
          notes: data.notes || ''
        });
      }
    } catch (error) {
      console.error('Error loading capacity config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load capacity configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        team_id: teamId,
        ...config,
        created_by: user?.id
      };

      if (configId) {
        // Update existing
        const { error } = await supabase
          .from('team_capacity_config')
          .update(config)
          .eq('id', configId);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('team_capacity_config')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        if (data) setConfigId(data.id);
      }

      toast({
        title: 'Success',
        description: 'Team capacity configuration saved successfully'
      });
    } catch (error) {
      console.error('Error saving capacity config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save capacity configuration',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <CardTitle>Team Capacity Configuration</CardTitle>
        </div>
        <CardDescription>
          Configure minimum and maximum staffing requirements for <strong>{teamName}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="min_staff">
              Minimum Staff Required Per Day <span className="text-destructive">*</span>
            </Label>
            <Input
              id="min_staff"
              type="number"
              min="1"
              value={config.min_staff_required}
              onChange={(e) => setConfig({ ...config, min_staff_required: parseInt(e.target.value) || 1 })}
              placeholder="e.g., 2"
            />
            <p className="text-xs text-muted-foreground">
              Used for coverage gap detection and analytics
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_staff">Maximum Staff Allowed (Optional)</Label>
            <Input
              id="max_staff"
              type="number"
              min="1"
              value={config.max_staff_allowed || ''}
              onChange={(e) => setConfig({ 
                ...config, 
                max_staff_allowed: e.target.value ? parseInt(e.target.value) : null 
              })}
              placeholder="e.g., 5"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for no maximum limit
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="weekends">Apply to Weekends</Label>
            <p className="text-sm text-muted-foreground">
              Include weekends in coverage requirements
            </p>
          </div>
          <Switch
            id="weekends"
            checked={config.applies_to_weekends}
            onCheckedChange={(checked) => setConfig({ ...config, applies_to_weekends: checked })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={config.notes}
            onChange={(e) => setConfig({ ...config, notes: e.target.value })}
            placeholder="Add any additional notes about capacity requirements..."
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {configId ? 'Configuration exists' : 'No configuration set (using defaults)'}
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
