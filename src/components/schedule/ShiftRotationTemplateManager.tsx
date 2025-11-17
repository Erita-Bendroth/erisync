import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { useRotationTemplates } from '@/hooks/useRotationTemplates';
import { ShiftRotationTemplateDialog } from './ShiftRotationTemplateDialog';
import { getPatternSummary } from '@/lib/rotationPatternUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ShiftRotationTemplateManagerProps {
  teams: Array<{ id: string; name: string }>;
}

export const ShiftRotationTemplateManager = ({ teams }: ShiftRotationTemplateManagerProps) => {
  const teamIds = teams.map((t) => t.id);
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useRotationTemplates(teamIds);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleSave = async (templateData: any) => {
    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, templateData);
    } else {
      await createTemplate(templateData);
    }
  };

  const handleDeleteClick = (templateId: string) => {
    setTemplateToDelete(templateId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (templateToDelete) {
      await deleteTemplate(templateToDelete);
      setTemplateToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const getTeamNames = (teamIds: string[]) => {
    return teams.filter((t) => teamIds.includes(t.id)).map((t) => t.name);
  };

  const myTemplates = templates.filter((t) => !t.is_public);
  const publicTemplates = templates.filter((t) => t.is_public);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Shift Rotation Templates</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage reusable rotation patterns for your teams
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
      ) : (
        <>
          {/* My Templates */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Your Templates ({myTemplates.length})
            </h4>
            {myTemplates.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No templates yet. Create your first rotation template.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {myTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {template.template_name}
                          </CardTitle>
                          <CardDescription>
                            {template.description || getPatternSummary(template)}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {getTeamNames(template.team_ids).map((name) => (
                          <Badge key={name} variant="secondary">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Public Templates */}
          {publicTemplates.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">
                Public Templates ({publicTemplates.length})
              </h4>
              <div className="space-y-2">
                {publicTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {template.template_name}
                            <Badge variant="outline" className="ml-2">
                              Public
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            {template.description || getPatternSummary(template)}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {getTeamNames(template.team_ids).map((name) => (
                          <Badge key={name} variant="secondary">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ShiftRotationTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teams={teams}
        template={editingTemplate}
        onSave={handleSave}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rotation template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
