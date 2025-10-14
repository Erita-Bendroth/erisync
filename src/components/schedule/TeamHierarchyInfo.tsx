import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Network } from 'lucide-react';

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
    <Card className="bg-muted/50 border-primary/20">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <Network className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Hierarchical View:</span>
              {isTopLevel && (
                <Badge variant="destructive" className="text-xs">
                  Top-Level (Full Access)
                </Badge>
              )}
              {isMidLevel && (
                <Badge variant="default" className="text-xs">
                  Mid-Level (Team + Sub-teams)
                </Badge>
              )}
              {!isTopLevel && !isMidLevel && (
                <Badge variant="secondary" className="text-xs">
                  Lower-Level (Team Only)
                </Badge>
              )}
            </div>
            
            {parentChain.length > 1 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Path:</span>{' '}
                {parentChain.map((t, idx) => (
                  <React.Fragment key={t.id}>
                    {idx > 0 && ' → '}
                    <span className={idx === parentChain.length - 1 ? 'font-semibold text-foreground' : ''}>
                      {t.name}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}
            
            {childTeams.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Includes {childTeams.length} sub-team{childTeams.length !== 1 ? 's' : ''}:</span>{' '}
                {childTeams.slice(0, 3).map(t => t.name).join(', ')}
                {childTeams.length > 3 && ` +${childTeams.length - 3} more`}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
