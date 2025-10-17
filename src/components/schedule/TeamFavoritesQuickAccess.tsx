import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamFavorite } from '@/hooks/useTeamFavorites';

interface TeamFavoritesQuickAccessProps {
  favorites: TeamFavorite[];
  currentSelectedTeamIds: string[];
  onApplyFavorite: (teamIds: string[], name: string) => void;
}

export const TeamFavoritesQuickAccess: React.FC<TeamFavoritesQuickAccessProps> = ({
  favorites,
  currentSelectedTeamIds,
  onApplyFavorite,
}) => {
  if (favorites.length === 0) return null;

  const isActive = (favorite: TeamFavorite) => {
    if (currentSelectedTeamIds.length !== favorite.team_ids.length) return false;
    return favorite.team_ids.every(id => currentSelectedTeamIds.includes(id)) &&
           currentSelectedTeamIds.every(id => favorite.team_ids.includes(id));
  };

  return (
    <div className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center gap-2 p-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground px-2 shrink-0">
            <Star className="h-3 w-3" />
            <span className="font-medium">Quick Access:</span>
          </div>
          <div className="flex gap-2">
            {favorites.map((favorite) => {
              const active = isActive(favorite);
              return (
                <Button
                  key={favorite.id}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => onApplyFavorite(favorite.team_ids, favorite.name)}
                  className={cn(
                    "h-7 px-3 text-xs shrink-0 transition-all",
                    active && "shadow-sm"
                  )}
                >
                  <Star className={cn("h-3 w-3 mr-1.5", active ? "fill-current" : "")} />
                  {favorite.name}
                </Button>
              );
            })}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
