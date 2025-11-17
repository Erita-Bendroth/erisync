import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RotationTemplate {
  id: string;
  template_name: string;
  description: string | null;
  created_by: string;
  team_ids: string[];
  pattern_type: 'fixed_days' | 'repeating_sequence' | 'weekly_pattern' | 'custom';
  pattern_config: any;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export const useRotationTemplates = (teamIds: string[]) => {
  const [templates, setTemplates] = useState<RotationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (teamIds.length > 0) {
      fetchTemplates();
    }
  }, [teamIds.join(',')]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_rotation_templates')
        .select('*')
        .or(`is_public.eq.true,team_ids.ov.{${teamIds.join(',')}}`)
        .order('template_name');

      if (error) throw error;
      setTemplates((data || []) as RotationTemplate[]);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rotation templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (template: Omit<RotationTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('shift_rotation_templates')
        .insert({
          ...template,
          created_by: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchTemplates();
      toast({
        title: 'Success',
        description: 'Rotation template created successfully',
      });

      return data;
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to create rotation template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTemplate = async (id: string, updates: Partial<RotationTemplate>) => {
    try {
      const { error } = await supabase
        .from('shift_rotation_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchTemplates();
      toast({
        title: 'Success',
        description: 'Rotation template updated successfully',
      });
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to update rotation template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shift_rotation_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchTemplates();
      toast({
        title: 'Success',
        description: 'Rotation template deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rotation template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
};
