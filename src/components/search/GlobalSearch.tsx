import { useState, useEffect } from 'react';
import { Search, User, Users, Calendar, Clock } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';

interface SearchResult {
  users: Array<{ id: string; name: string; email?: string; type: 'user' }>;
  teams: Array<{ id: string; name: string; description: string; member_count: number; type: 'team' }>;
  schedules: Array<{ id: string; user_name: string; team_name: string; team_id: string; date: string; activity: string; shift: string; type: 'schedule' }>;
  total_results: number;
}

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
  
  // Load recent searches
  useEffect(() => {
    if (open && user) {
      fetchRecentSearches();
    }
  }, [open, user]);
  
  const fetchRecentSearches = async () => {
    const { data } = await supabase
      .from('search_history')
      .select('search_query')
      .eq('user_id', user?.id)
      .order('searched_at', { ascending: false })
      .limit(5);
    
    if (data) {
      setRecentSearches([...new Set(data.map(s => s.search_query))]);
    }
  };
  
  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults(null);
      return;
    }
    
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('global_search', {
          _search_query: query,
          _current_user_id: user?.id,
          _limit: 20
        });
        
        if (error) throw error;
        setResults(data as unknown as SearchResult);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, user]);
  
  const handleResultClick = (result: any) => {
    if (result.type === 'user') {
      navigate(`/schedule?tab=schedule&user=${result.id}`);
    } else if (result.type === 'team') {
      navigate(`/schedule?tab=schedule&team=${result.id}`);
    } else if (result.type === 'schedule') {
      navigate(`/schedule?tab=schedule&date=${result.date}&team=${result.team_id}`);
    }
    setOpen(false);
    setQuery('');
  };
  
  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md hover:bg-accent transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      
      {/* Search dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0">
          <div className="flex items-center border-b px-4 py-3">
            <Search className="h-5 w-5 mr-2 text-muted-foreground" />
            <Input
              placeholder="Search users, teams, schedules..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 focus-visible:ring-0"
              autoFocus
            />
          </div>
          
          <ScrollArea className="max-h-[400px]">
            {loading && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}
            
            {!query && recentSearches.length > 0 && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Recent Searches</span>
                </div>
                {recentSearches.map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuery(search)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md"
                  >
                    {search}
                  </button>
                ))}
              </div>
            )}
            
            {results && results.total_results === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No results found for "{query}"
              </div>
            )}
            
            {results && results.total_results > 0 && (
              <div className="p-2">
                {/* Users */}
                {results.users.length > 0 && (
                  <div className="mb-4">
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                      USERS
                    </div>
                    {results.users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleResultClick(user)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent rounded-md"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">{user.name}</div>
                          {user.email && <div className="text-xs text-muted-foreground">{user.email}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Teams */}
                {results.teams.length > 0 && (
                  <div className="mb-4">
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                      TEAMS
                    </div>
                    {results.teams.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => handleResultClick(team)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent rounded-md"
                      >
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">{team.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {team.member_count} members
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Schedules */}
                {results.schedules.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                      SCHEDULES
                    </div>
                    {results.schedules.map((schedule) => (
                      <button
                        key={schedule.id}
                        onClick={() => handleResultClick(schedule)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent rounded-md"
                      >
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">
                            {schedule.user_name} - {schedule.team_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(schedule.date).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{schedule.activity}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
