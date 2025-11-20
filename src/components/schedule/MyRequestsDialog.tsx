import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VacationRequestsList } from './VacationRequestsList';
import { ShiftSwapRequestsList } from './swap/ShiftSwapRequestsList';
import { ManagerSwapApprovals } from './swap/ManagerSwapApprovals';
import { Calendar, ArrowLeftRight } from 'lucide-react';

interface MyRequestsDialogProps {
  isPlanner: boolean;
  isManager: boolean;
  isAdmin: boolean;
  onRequestProcessed?: () => void;
  onEditRequest?: (request: any) => void;
}

export const MyRequestsDialog: React.FC<MyRequestsDialogProps> = ({
  isPlanner,
  isManager,
  isAdmin,
  onRequestProcessed,
  onEditRequest,
}) => {
  return (
    <Tabs defaultValue="vacation" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2 mb-6 flex-shrink-0">
        <TabsTrigger value="vacation" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Vacation Requests</span>
          <span className="sm:hidden">Vacation</span>
        </TabsTrigger>
        <TabsTrigger value="shift-swaps" className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          <span className="hidden sm:inline">Shift Swap Requests</span>
          <span className="sm:hidden">Swaps</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="vacation" className="space-y-4 mt-0 overflow-y-auto flex-1">
        <VacationRequestsList
          isPlanner={isPlanner}
          onRequestProcessed={onRequestProcessed}
          onEditRequest={onEditRequest}
        />
      </TabsContent>

      <TabsContent value="shift-swaps" className="space-y-4 mt-0 overflow-y-auto flex-1">
        {(isManager || isPlanner || isAdmin) && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Pending Approvals</h3>
            <ManagerSwapApprovals />
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold mb-4">
            {(isManager || isPlanner || isAdmin) ? 'All Swap Requests' : 'Your Swap Requests'}
          </h3>
          <ShiftSwapRequestsList />
        </div>
      </TabsContent>
    </Tabs>
  );
};
