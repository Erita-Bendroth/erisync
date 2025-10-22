import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Bookmark, Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';

interface ScheduleBookmarkData {
  id: string;
  name: string;
  bookmark_type: string;
  config: {
    team_ids?: string[];
    start_date?: string;
    end_date?: string;
  };
}

interface ScheduleBookmarksProps {
  currentTeamIds?: string[];
  currentStartDate?: string;
  currentEndDate?: string;
  onLoadBookmark?: (config: any) => void;
}

export const ScheduleBookmarks = ({ 
  currentTeamIds, 
  currentStartDate, 
  currentEndDate,
  onLoadBookmark 
}: ScheduleBookmarksProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<ScheduleBookmarkData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bookmarkName, setBookmarkName] = useState('');

  useEffect(() => {
    loadBookmarks();
  }, [user]);

  const loadBookmarks = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedule_bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookmarks((data || []).map(item => ({
        ...item,
        config: item.config as { team_ids?: string[]; start_date?: string; end_date?: string; }
      })));
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentView = async () => {
    if (!bookmarkName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for this bookmark',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('schedule_bookmarks')
        .insert({
          user_id: user?.id,
          name: bookmarkName.trim(),
          bookmark_type: 'date_range',
          config: {
            team_ids: currentTeamIds,
            start_date: currentStartDate,
            end_date: currentEndDate
          }
        });

      if (error) throw error;

      toast({
        title: 'Bookmark Saved',
        description: `"${bookmarkName}" saved successfully`
      });

      setBookmarkName('');
      setDialogOpen(false);
      loadBookmarks();
    } catch (error: any) {
      console.error('Error saving bookmark:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save bookmark',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteBookmark = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('schedule_bookmarks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Bookmark Deleted',
        description: `"${name}" removed`
      });

      loadBookmarks();
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete bookmark',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark className="h-4 w-4 mr-2" />
            Bookmarks {bookmarks.length > 0 && `(${bookmarks.length})`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              No bookmarks yet
            </div>
          ) : (
            <>
              {bookmarks.map((bookmark) => (
                <DropdownMenuItem
                  key={bookmark.id}
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => onLoadBookmark?.(bookmark.config)}
                >
                  <span className="flex-1 truncate">{bookmark.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBookmark(bookmark.id, bookmark.name);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={() => setDialogOpen(true)}
            className="font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Save Current View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Bookmark Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Schedule Bookmark</DialogTitle>
            <DialogDescription>
              Save the current schedule view for quick access later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bookmark-name">Bookmark Name</Label>
              <Input
                id="bookmark-name"
                placeholder="e.g., Q4 Planning View"
                value={bookmarkName}
                onChange={(e) => setBookmarkName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveCurrentView()}
              />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>This will save:</p>
              <ul className="list-disc list-inside pl-2">
                {currentTeamIds && <li>{currentTeamIds.length} selected team(s)</li>}
                {currentStartDate && <li>Date range: {currentStartDate} to {currentEndDate}</li>}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrentView} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Bookmark'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
