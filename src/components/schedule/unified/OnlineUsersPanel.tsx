import React from 'react';
import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { OnlineUser } from '@/hooks/useSchedulerPresence';

interface OnlineUsersPanelProps {
  users: OnlineUser[];
}

export const OnlineUsersPanel: React.FC<OnlineUsersPanelProps> = ({ users }) => {
  if (users.length === 0) return null;

  return (
    <Card className="p-3 border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Online ({users.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {users.map((user) => (
          <Badge
            key={user.user_id}
            variant="secondary"
            className="flex items-center gap-2 px-2 py-1 bg-secondary/50"
          >
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: user.color }}
            />
            <span className="text-xs text-foreground">
              {user.first_name} {user.last_name}
            </span>
            {user.editing_cell && (
              <span className="text-[10px] text-muted-foreground">
                (editing)
              </span>
            )}
          </Badge>
        ))}
      </div>
    </Card>
  );
};
