import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Users, Settings, Waves } from 'lucide-react';
import { PartnershipCapacityConfig } from '../PartnershipCapacityConfig';
import { OffshorePatternPanel } from '../partnerships/OffshorePatternPanel';

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
  const [patternDialogOpen, setPatternDialogOpen] = useState(false);
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPatternDialogOpen(true)}
              title="Configure offshore shift pattern (E / L / N / WO)"
              className="gap-1"
            >
              <Waves className="h-4 w-4 text-cyan-600" />
              <span className="hidden sm:inline text-xs">Shift Pattern</span>
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

      {/* Shift Pattern Dialog */}
      {selectedPartnership && patternDialogOpen && (
        <Dialog open={patternDialogOpen} onOpenChange={setPatternDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Waves className="h-5 w-5 text-cyan-600" />
                Shift Pattern — {selectedPartnership.partnership_name}
              </DialogTitle>
              <DialogDescription>
                Enable offshore mode and configure shift codes (E / L / N / WO) with recovery-day rules for this partnership.
              </DialogDescription>
            </DialogHeader>
            <OffshorePatternPanel partnershipId={selectedPartnership.id} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
