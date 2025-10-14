import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Network } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  parent_team_id?: string;
}

interface TeamHierarchyInfoProps {
  selectedTeamId: string;
  teams: Team[];
}

export const TeamHierarchyInfo: React.FC<TeamHierarchyInfoProps> = ({ selectedTeamId, teams }) => {
  if (selectedTeamId === "all") {
    return null;
  }

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  if (!selectedTeam) return null;

  // Find parent chain
  const getParentChain = (team: Team): Team[] => {
    const chain: Team[] = [team];
    let currentTeam = team;
    
    while (currentTeam.parent_team_id) {
      const parent = teams.find(t => t.id === currentTeam.parent_team_id);
      if (!parent) break;
      chain.unshift(parent);
      currentTeam = parent;
    }
    
    return chain;
  };

  // Find all child teams recursively
  const getAllChildren = (teamId: string): Team[] => {
    const directChildren = teams.filter(t => t.parent_team_id === teamId);
    const allChildren: Team[] = [...directChildren];
    
    directChildren.forEach(child => {
      allChildren.push(...getAllChildren(child.id));
    });
    
    return allChildren;
  };

  const parentChain = getParentChain(selectedTeam);
  const childTeams = getAllChildren(selectedTeam.id);
  const isTopLevel = !selectedTeam.parent_team_id;
  const isMidLevel = selectedTeam.parent_team_id && childTeams.length > 0;

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-primary/30 shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-primary/10 ring-2 ring-primary/20">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">Team Hierarchy:</span>
              {isTopLevel && (
                <Badge variant="destructive" className="text-xs shadow-sm gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  Top-Level Access
                </Badge>
              )}
              {isMidLevel && (
                <Badge className="text-xs shadow-sm gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-600 dark:bg-yellow-400" />
                  Mid-Level Access
                </Badge>
              )}
              {!isTopLevel && !isMidLevel && (
                <Badge variant="secondary" className="text-xs shadow-sm">
                  Team-Level Access
                </Badge>
              )}
            </div>
            
            {parentChain.length > 1 && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-background/60 backdrop-blur-sm border">
                <div className="text-xs text-muted-foreground font-medium min-w-fit">Path:</div>
                <div className="text-xs">
                  {parentChain.map((t, idx) => (
                    <React.Fragment key={t.id}>
                      {idx > 0 && <span className="text-muted-foreground mx-1.5">→</span>}
                      <span className={cn(
                        "transition-colors",
                        idx === parentChain.length - 1 
                          ? 'font-semibold text-primary' 
                          : 'text-foreground'
                      )}>
                        {t.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            
            {childTeams.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-background/60 backdrop-blur-sm border">
                <div className="text-xs text-muted-foreground font-medium min-w-fit">
                  Includes:
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-primary">{childTeams.length} sub-team{childTeams.length !== 1 ? 's' : ''}</span>
                  <span className="text-muted-foreground mx-1.5">–</span>
                  <span className="text-muted-foreground">
                    {childTeams.slice(0, 3).map(t => t.name).join(', ')}
                    {childTeams.length > 3 && <span className="font-medium"> +{childTeams.length - 3} more</span>}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
