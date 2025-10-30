import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Settings, Trash2, Edit2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useTeamFavorites } from '@/hooks/useTeamFavorites';

interface TeamFavoritesManagerProps {
  currentSelectedTeamIds: string[];
  teams: Array<{ id: string; name: string }>;
  onApplyFavorite: (teamIds: string[], name: string) => void;
  viewContext: 'schedule' | 'multi-team';
}

export const TeamFavoritesManager: React.FC<TeamFavoritesManagerProps> = ({
  currentSelectedTeamIds,
  teams,
  onApplyFavorite,
  viewContext,
}) => {
  const { toast } = useToast();
  const { favorites, refetchFavorites } = useTeamFavorites(viewContext);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [favoriteName, setFavoriteName] = useState('');
  const [editingFavorite, setEditingFavorite] = useState<any>(null);
  const [deletingFavorite, setDeletingFavorite] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSaveFavorite = async () => {
    if (!favoriteName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for this favorite view',
        variant: 'destructive',
      });
      return;
    }

    if (currentSelectedTeamIds.length === 0) {
      toast({
        title: 'No Teams Selected',
        description: 'Please select at least one team to save as favorite',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('team_view_favorites')
      .insert({
        user_id: user.id,
        name: favoriteName.trim(),
        team_ids: currentSelectedTeamIds,
        view_context: viewContext,
      });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: 'Duplicate Name',
            description: 'A favorite with this name already exists',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'Favorite Saved',
        description: `"${favoriteName}" has been saved successfully`,
      });

      setFavoriteName('');
      setShowSaveDialog(false);
      refetchFavorites();
    } catch (error) {
      console.error('Error saving favorite:', error);
      toast({
        title: 'Error',
        description: 'Failed to save favorite view',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFavorite = async () => {
    if (!editingFavorite || !favoriteName.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('team_view_favorites')
        .update({
          name: favoriteName.trim(),
          team_ids: currentSelectedTeamIds,
        })
        .eq('id', editingFavorite.id);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Duplicate Name',
            description: 'A favorite with this name already exists',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'Favorite Updated',
        description: `"${favoriteName}" has been updated successfully`,
      });

      setFavoriteName('');
      setShowEditDialog(false);
      setEditingFavorite(null);
      refetchFavorites();
    } catch (error) {
      console.error('Error updating favorite:', error);
      toast({
        title: 'Error',
        description: 'Failed to update favorite view',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFavorite = async () => {
    if (!deletingFavorite) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('team_view_favorites')
        .delete()
        .eq('id', deletingFavorite.id);

      if (error) throw error;

      toast({
        title: 'Favorite Deleted',
        description: `"${deletingFavorite.name}" has been deleted`,
      });

      setShowDeleteDialog(false);
      setDeletingFavorite(null);
      refetchFavorites();
    } catch (error) {
      console.error('Error deleting favorite:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete favorite view',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFavorite = (favorite: any) => {
    onApplyFavorite(favorite.team_ids, favorite.name);
    toast({
      title: 'Favorite Applied',
      description: `Viewing teams from "${favorite.name}"`,
    });
  };

  const getTeamNamesForFavorite = (teamIds: string[]) => {
    return teamIds
      .map(id => teams.find(t => t.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <>
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" className="gap-2">
              <Settings className="h-4 w-4" />
              Manage Favorites
              {favorites.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {favorites.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>
            {viewContext === 'multi-team' ? 'Saved Multi-Team Views' : 'Saved Team Views'}
          </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {favorites.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No saved favorites yet
              </div>
            ) : (
              favorites.map((favorite) => (
                <div key={favorite.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm">
                  <button
                    onClick={() => handleApplyFavorite(favorite)}
                    className="flex-1 text-left text-sm"
                  >
                    <div className="font-medium">{favorite.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {getTeamNamesForFavorite(favorite.team_ids)}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setEditingFavorite(favorite);
                      setFavoriteName(favorite.name);
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={() => {
                      setDeletingFavorite(favorite);
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setShowSaveDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Save Current View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Save Favorite Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current View as Favorite</DialogTitle>
            <DialogDescription>
              Create a shortcut to quickly access this team selection
              {currentSelectedTeamIds.length > 0 && (
                <span className="block mt-2 text-sm">
                  Selected teams: {currentSelectedTeamIds.length}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="favorite-name">Favorite Name</Label>
              <Input
                id="favorite-name"
                placeholder="e.g., Plant Teams, North Region"
                value={favoriteName}
                onChange={(e) => setFavoriteName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFavorite()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFavorite} disabled={loading}>
              {loading ? 'Saving...' : 'Save Favorite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Favorite Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Favorite</DialogTitle>
            <DialogDescription>
              Update the name and team selection for this favorite
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-favorite-name">Favorite Name</Label>
              <Input
                id="edit-favorite-name"
                placeholder="e.g., Plant Teams, North Region"
                value={favoriteName}
                onChange={(e) => setFavoriteName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateFavorite()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFavorite} disabled={loading}>
              {loading ? 'Updating...' : 'Update Favorite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Favorite?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFavorite?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFavorite} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
