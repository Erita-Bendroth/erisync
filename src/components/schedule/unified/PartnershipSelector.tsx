import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, Settings, Waves } from 'lucide-react';
import { PartnershipCapacityConfig } from '../PartnershipCapacityConfig';
import { isOffshoreByTeamNames } from '@/lib/offshorePattern';

interface Partnership {
  id: string;
  partnership_name: string;
  team_ids: string[];
}

interface PartnershipSelectorProps {
  value: string;
  onChange: (partnershipId: string, teamIds: string[]) => void;
}

export const PartnershipSelector: React.FC<PartnershipSelectorProps> = ({
  value,
  onChange,
}) => {
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [offshoreByPartnership, setOffshoreByPartnership] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPartnerships();
  }, []);

  // Detect which partnerships have offshore mode enabled (any roster flagged)
  useEffect(() => {
    if (partnerships.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('partnership_rotation_rosters')
        .select('partnership_id, offshore_mode')
        .in('partnership_id', partnerships.map(p => p.id))
        .eq('offshore_mode', true);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r: any) => { map[r.partnership_id] = true; });

      // Also auto-mark partnerships whose teams include an "Offshore" team
      const allTeamIds = Array.from(new Set(partnerships.flatMap(p => p.team_ids)));
      if (allTeamIds.length > 0) {
        const { data: teams } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', allTeamIds);
        const nameById = new Map((teams ?? []).map((t: any) => [t.id, t.name as string]));
        partnerships.forEach((p) => {
          const names = p.team_ids.map((id) => nameById.get(id) ?? '');
          if (isOffshoreByTeamNames(names)) map[p.id] = true;
        });
      }
      setOffshoreByPartnership(map);
    })();
  }, [partnerships]);

  const fetchPartnerships = async () => {
    try {
      const { data, error } = await supabase
        .from('team_planning_partners')
        .select('*')
        .order('partnership_name');

      if (error) throw error;
      
      setPartnerships(data || []);
      
      // Auto-select first partnership
      if (data && data.length > 0 && !value) {
        onChange(data[0].id, data[0].team_ids);
      }
    } catch (error) {
      console.error('Error fetching partnerships:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (partnershipId: string) => {
    const partnership = partnerships.find(p => p.id === partnershipId);
    if (partnership) {
      console.log('Partnership selected:', partnership.partnership_name, 'Teams:', partnership.team_ids);
      onChange(partnershipId, partnership.team_ids);
    }
  };

  const selectedPartnership = partnerships.find(p => p.id === value);

  return (
    <>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Partnership:</Label>
        <Select value={value} onValueChange={handleChange} disabled={loading}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={loading ? "Loading partnerships..." : "Select partnership"} />
          </SelectTrigger>
          <SelectContent>
            {partnerships.map((partnership) => (
              <SelectItem key={partnership.id} value={partnership.id}>
                {partnership.partnership_name}
                <span className="text-xs text-muted-foreground ml-2">
                  ({partnership.team_ids.length} teams)
                </span>
              </SelectItem>
            ))}
            {partnerships.length === 0 && !loading && (
              <SelectItem value="none" disabled>
                No partnerships found
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        
        {/* Capacity Config Button */}
        {value && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigDialogOpen(true)}
              title="Configure partnership capacity"
            >
              <Settings className="h-4 w-4" />
            </Button>
            {offshoreByPartnership[value] && (
              <Badge variant="outline" className="border-cyan-500 text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/30 gap-1">
                <Waves className="h-3 w-3" /> Offshore
              </Badge>
            )}
          </>
        )}
      </div>

      {/* Capacity Config Dialog */}
      {selectedPartnership && (
        <PartnershipCapacityConfig
          partnershipId={selectedPartnership.id}
          partnershipName={selectedPartnership.partnership_name}
          teamIds={selectedPartnership.team_ids}
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
        />
      )}
    </>
  );
};
