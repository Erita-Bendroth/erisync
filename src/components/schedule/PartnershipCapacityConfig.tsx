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
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Teams in Partnership</h4>
                  <div className="flex flex-wrap gap-2">
                    {teams.map((team) => (
                      <Badge key={team.id} variant="secondary">
                        {team.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={config.notes || ""}
                    onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                    placeholder="Add any additional notes about this partnership..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
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
