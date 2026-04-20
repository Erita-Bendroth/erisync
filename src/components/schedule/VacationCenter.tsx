import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Users, BarChart3, Plus } from 'lucide-react';
import { VacationRequestsList } from './VacationRequestsList';
import { VacationRequestModal } from './VacationRequestModal';
import { VacationPlanningDashboard } from './vacation-planning/VacationPlanningDashboard';

interface VacationCenterProps {
  isAdmin: boolean;
  isPlanner: boolean;
  isManager: boolean;
  teams: Array<{ id: string; name: string }>;
}

/**
 * Unified vacation center — single home for everything vacation-related.
 *
 * Sub-tabs are URL-driven (`?sub=my|team|planning`) so deep links from
 * other surfaces (Dashboard PendingRequestsCard, MyRequests button, etc.)
 * land on the right view.
 */
export const VacationCenter: React.FC<VacationCenterProps> = ({
  isAdmin,
  isPlanner,
  isManager,
  teams,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = isAdmin || isPlanner || isManager;

  const initialSub = searchParams.get('sub') || 'my';
  const [subTab, setSubTab] = useState<string>(initialSub);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [editRequest, setEditRequest] = useState<any>(null);

  // Keep URL ↔ state in sync
  useEffect(() => {
    const sub = searchParams.get('sub');
    if (sub && sub !== subTab) setSubTab(sub);
  }, [searchParams]);

  const handleSubChange = (value: string) => {
    setSubTab(value);
    const next = new URLSearchParams(searchParams);
    next.set('sub', value);
    setSearchParams(next, { replace: true });
  };

  const teamIds = useMemo(() => teams.map(t => t.id), [teams]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Vacation</h2>
          <p className="text-muted-foreground text-sm">
            Submit time off, track your requests, and (for managers) review the team and capacity.
          </p>
        </div>
        <Button onClick={() => { setEditRequest(null); setRequestModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Request Time Off
        </Button>
      </div>

      <Tabs value={subTab} onValueChange={handleSubChange} className="space-y-4">
        <TabsList className={canManage ? 'grid w-full grid-cols-3' : 'grid w-full grid-cols-1'}>
          <TabsTrigger value="my">
            <Calendar className="w-4 h-4 mr-2" />
            My Requests
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="team">
              <Users className="w-4 h-4 mr-2" />
              Team
            </TabsTrigger>
          )}
          {canManage && (
            <TabsTrigger value="planning">
              <BarChart3 className="w-4 h-4 mr-2" />
              Planning
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my" className="space-y-4">
          <VacationRequestsList
            isPlanner={false}
            isManager={false}
            onEditRequest={(req) => { setEditRequest(req); setRequestModalOpen(true); }}
          />
        </TabsContent>

        {canManage && (
          <TabsContent value="team" className="space-y-4">
            <VacationRequestsList
              isPlanner={isPlanner || isAdmin}
              isManager={isManager}
              onEditRequest={(req) => { setEditRequest(req); setRequestModalOpen(true); }}
            />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="planning" className="space-y-4">
            <VacationPlanningDashboard teamIds={teamIds} teams={teams} />
          </TabsContent>
        )}
      </Tabs>

      <VacationRequestModal
        open={requestModalOpen}
        onOpenChange={(open) => {
          setRequestModalOpen(open);
          if (!open) setEditRequest(null);
        }}
        onRequestSubmitted={() => setEditRequest(null)}
        editRequest={editRequest}
      />
    </div>
  );
};
