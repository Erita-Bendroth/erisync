import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { PartnershipRotationManager } from './partnerships/PartnershipRotationManager';
import { ShiftRequirements } from './partnerships/ShiftRequirements';

interface PartnershipCapacityConfigProps {
  partnershipId: string;
  partnershipName: string;
  teamIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface CapacityConfig {
  min_staff_required: number;
  max_staff_allowed: number | null;
  applies_to_weekends: boolean;
  notes: string;
}

export const PartnershipCapacityConfig: React.FC<PartnershipCapacityConfigProps> = ({
  partnershipId,
  partnershipName,
  teamIds,
  open,
  onOpenChange,
  onSaved,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("capacity");
  const [config, setConfig] = useState<CapacityConfig>({
    min_staff_required: 1,
    max_staff_allowed: null,
    applies_to_weekends: false,
    notes: ''
  });
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (open) {
      loadConfig();
      loadTeamNames();
    }
  }, [open, partnershipId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('partnership_capacity_config')
        .select('*')
        .eq('partnership_id', partnershipId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading config:', error);
        return;
      }

      if (data) {
        setConfig({
          min_staff_required: data.min_staff_required,
          max_staff_allowed: data.max_staff_allowed,
          applies_to_weekends: data.applies_to_weekends,
          notes: data.notes || ''
        });
      }
    } catch (error) {
      console.error('Error loading partnership capacity config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamNames = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds)
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error loading team names:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('partnership_capacity_config')
        .upsert({
          partnership_id: partnershipId,
          min_staff_required: config.min_staff_required,
          max_staff_allowed: config.max_staff_allowed,
          applies_to_weekends: config.applies_to_weekends,
          notes: config.notes,
          created_by: user.id,
        }, {
          onConflict: 'partnership_id'
        });

      if (error) throw error;

      toast({
        title: 'Configuration saved',
        description: 'Partnership capacity configuration has been updated.',
      });

      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error saving configuration',
        description: 'Failed to save partnership capacity configuration.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Partnership Settings - {partnershipName}</DialogTitle>
          <DialogDescription>
            Manage capacity configuration and rotation rosters for this partnership
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="capacity">General</TabsTrigger>
            <TabsTrigger value="shifts">Shift Requirements</TabsTrigger>
            <TabsTrigger value="rotations">Rotation Rosters</TabsTrigger>
          </TabsList>

          <TabsContent value="capacity">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Display teams in partnership */}
                <div className="rounded-md border border-border p-3 bg-muted/30">
                  <Label className="text-sm font-semibold">Teams in Partnership:</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {teams.map(team => (
                      <Badge key={team.id} variant="secondary">{team.name}</Badge>
                    ))}
                  </div>
                </div>

                {/* Configuration Form */}
                <div className="space-y-4 mt-4">
                  {/* Min Staff Required */}
                  <div>
                    <Label htmlFor="min-staff">Minimum Staff Required (Total across all teams)</Label>
                    <Input
                      id="min-staff"
                      type="number"
                      min={1}
                      value={config.min_staff_required}
                      onChange={(e) => setConfig({ ...config, min_staff_required: parseInt(e.target.value) || 1 })}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Total minimum number of people needed across all {teams.length} teams
                    </p>
                  </div>

                  {/* Max Staff Allowed */}
                  <div>
                    <Label htmlFor="max-staff">Maximum Staff Allowed (Optional)</Label>
                    <Input
                      id="max-staff"
                      type="number"
                      min={config.min_staff_required}
                      value={config.max_staff_allowed || ''}
                      onChange={(e) => setConfig({ 
                        ...config, 
                        max_staff_allowed: e.target.value ? parseInt(e.target.value) : null 
                      })}
                      placeholder="No maximum"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty for no maximum limit
                    </p>
                  </div>

                  {/* Applies to Weekends */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="weekends"
                      checked={config.applies_to_weekends}
                      onCheckedChange={(checked) => setConfig({ ...config, applies_to_weekends: checked })}
                    />
                    <Label htmlFor="weekends" className="cursor-pointer">
                      Apply these requirements to weekends
                    </Label>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any notes about capacity requirements..."
                      value={config.notes}
                      onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving || loading}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>

          <TabsContent value="shifts">
            <ShiftRequirements partnershipId={partnershipId} />
          </TabsContent>

          <TabsContent value="rotations">
            <PartnershipRotationManager
              partnershipId={partnershipId}
              partnershipName={partnershipName}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
