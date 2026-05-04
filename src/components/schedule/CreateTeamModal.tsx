import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Team {
  id: string;
  name: string;
  description?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allTeams: Team[];
  onTeamCreated: () => void;
}

const NONE = "__none__";

export const CreateTeamModal: React.FC<Props> = ({ open, onOpenChange, allTeams, onTeamCreated }) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>(NONE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setParentId(NONE);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Team name is required.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Team name must be 100 characters or fewer.");
      return;
    }
    const duplicate = allTeams.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setError("A team with this name already exists.");
      return;
    }

    try {
      setSubmitting(true);
      const { error: insertError } = await supabase.from("teams").insert({
        name: trimmed,
        description: description.trim() || null,
        parent_team_id: parentId === NONE ? null : parentId,
      });
      if (insertError) throw insertError;

      toast({ title: "Team created", description: `"${trimmed}" was created successfully.` });
      reset();
      onOpenChange(false);
      onTeamCreated();
    } catch (err: any) {
      console.error("Create team failed:", err);
      setError(err?.message || "Failed to create the team.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new team</DialogTitle>
          <DialogDescription>
            Add a new team to your organisation. You can optionally nest it under an existing team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="team-name">Team name *</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Support EU"
              maxLength={100}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-description">Description</Label>
            <Textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional short description"
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent-team">Parent team (optional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger id="parent-team">
                <SelectValue placeholder="No parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No parent (top-level team)</SelectItem>
                {allTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nested teams inherit the manager hierarchy of their parent.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTeamModal;