interface Team {
  id: string;
  name: string;
  parent_team_id: string | null;
}

interface HierarchicalTeams {
  topLevel: Team[];
  childrenMap: Map<string, Team[]>;
}

/**
 * Groups teams by hierarchy (parent-child relationships)
 * Returns top-level teams and a map of parent_id -> children
 */
export function groupTeamsByHierarchy(teams: Team[]): HierarchicalTeams {
  const childrenMap = new Map<string, Team[]>();
  const topLevel: Team[] = [];

  // First pass: identify top-level teams and build children map
  teams.forEach(team => {
    if (team.parent_team_id) {
      if (!childrenMap.has(team.parent_team_id)) {
        childrenMap.set(team.parent_team_id, []);
      }
      childrenMap.get(team.parent_team_id)!.push(team);
    } else {
      topLevel.push(team);
    }
  });

  // Sort children by name
  childrenMap.forEach(children => {
    children.sort((a, b) => a.name.localeCompare(b.name));
  });

  // Sort top-level by name
  topLevel.sort((a, b) => a.name.localeCompare(b.name));

  return { topLevel, childrenMap };
}

/**
 * Gets all team IDs including children recursively
 */
export function getAllTeamIdsWithChildren(
  teamId: string,
  childrenMap: Map<string, Team[]>
): string[] {
  const ids = [teamId];
  const children = childrenMap.get(teamId) || [];
  
  children.forEach(child => {
    ids.push(...getAllTeamIdsWithChildren(child.id, childrenMap));
  });
  
  return ids;
}

/**
 * Gets the display name for a child team (removes parent name prefix)
 */
export function getChildTeamDisplayName(childName: string, parentName: string): string {
  return childName
    .replace(parentName, '')
    .replace(/^[\s-]+/, '')
    .replace(/[\s-]+$/, '')
    .trim();
}

/**
 * Filters teams to only include Troubleshooting teams
 * Excludes parent Operations and Support teams from display
 */
export function filterTroubleshootingTeams(teams: Team[]): Team[] {
  return teams.filter(team => 
    team.name.includes('Troubleshooting') ||
    (!team.name.includes('Operations') && !team.name.includes('Support'))
  );
}
