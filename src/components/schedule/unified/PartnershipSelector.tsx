import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';

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

  useEffect(() => {
    fetchPartnerships();
  }, []);

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
      onChange(partnershipId, partnership.team_ids);
    }
  };

  return (
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
    </div>
  );
};
