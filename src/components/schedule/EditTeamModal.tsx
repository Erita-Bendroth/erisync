import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Pencil } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  description?: string;
}

interface EditTeamModalProps {
  team: Team | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTeamUpdated: () => void;
  allTeams: Team[];
}

export const EditTeamModal: React.FC<EditTeamModalProps> = ({
  team,
  open,
  onOpenChange,
  onTeamUpdated,
  allTeams,
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (team) {
      setTeamName(team.name);
      setTeamDescription(team.description || '');
      setValidationError(null);
    }
  }, [team]);

  const validateTeamName = (name: string): boolean => {
    // Check if name is empty
    if (!name.trim()) {
      setValidationError('Team name cannot be empty');
      return false;
    }

    // Check if name is unique (excluding current team)
    const isDuplicate = allTeams.some(
      (t) => t.id !== team?.id && t.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (isDuplicate) {
      setValidationError('A team with this name already exists');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!team) return;

    if (!validateTeamName(teamName)) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Update the team
      const { error: updateError } = await supabase
        .from('teams')
        .update({
          name: teamName.trim(),
          description: teamDescription.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', team.id);

      if (updateError) throw updateError;

      // Create audit log entry
      const { error: auditError } = await supabase
        .from('team_audit_log')
        .insert({
          team_id: team.id,
          action: 'update',
          changed_by: user.id,
          changes: {
            old_name: team.name,
            new_name: teamName.trim(),
            old_description: team.description || null,
            new_description: teamDescription.trim() || null,
          },
        });

      if (auditError) {
        console.error('Failed to create audit log:', auditError);
        // Don't fail the whole update if audit logging fails
      }

      toast({
        title: "Team updated",
        description: `"${teamName}" has been successfully updated.`,
      });

      // Reset form
      setTeamName('');
      setTeamDescription('');
      setValidationError(null);
      
      onTeamUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating team:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update team",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNameChange = (value: string) => {
    setTeamName(value);
    if (validationError) {
      validateTeamName(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Pencil className="h-5 w-5 text-primary" />
            </div>
            Edit Team
          </DialogTitle>
          <DialogDescription className="text-base">
            Update the team name and description. Changes will be reflected across the entire application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Validation Error Alert */}
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Team Name */}
          <div className="space-y-2">
            <Label htmlFor="team-name" className="text-base font-semibold">
              Team Name *
            </Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => validateTeamName(teamName)}
              placeholder="Enter team name"
              className={validationError ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Team name must be unique across the organization
            </p>
          </div>

          {/* Team Description */}
          <div className="space-y-2">
            <Label htmlFor="team-description" className="text-base font-semibold">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="team-description"
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              placeholder="Add a description for this team..."
              className="resize-none min-h-[100px]"
              rows={4}
            />
          </div>

          {/* Original Values Reference */}
          {team && (team.name !== teamName || (team.description || '') !== teamDescription) && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium mb-2">Original Values:</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div><span className="font-medium">Name:</span> {team.name}</div>
                {team.description && (
                  <div><span className="font-medium">Description:</span> {team.description}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !!validationError || !teamName.trim()}
            className="w-full sm:w-auto gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
