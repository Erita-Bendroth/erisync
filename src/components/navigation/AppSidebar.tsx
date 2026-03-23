import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Settings, 
  BarChart3,
  CalendarCheck,
  FileCheck,
  Shield,
  BookOpen,
  UserCircle,
  Star,
  RotateCcw
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { useTeamFavorites } from '@/hooks/useTeamFavorites';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { DraggableSidebarMenuItem } from './DraggableSidebarMenuItem';
import { useSidebarOrder } from '@/hooks/useSidebarOrder';
import { Button } from '@/components/ui/button';
import { usePendingRequestsCount } from '@/hooks/usePendingRequestsCount';
import { useCurrentUserContext } from '@/hooks/useCurrentUserContext';

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { highestRole, isManagerOrPlanner } = useCurrentUserContext();
  const { getSortedItems, updateOrder, resetOrder } = useSidebarOrder();
  const { total: pendingRequestsTotal } = usePendingRequestsCount();

  const [allItems, setAllItems] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const isCollapsed = state === 'collapsed';
  const isActive = (path: string) => location.pathname === path;

  const mainNavItems = [
    { key: 'nav-dashboard', title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    ...(isManagerOrPlanner ? [
      { key: 'nav-analytics', title: 'Analytics', icon: BarChart3, path: '/analytics' }
    ] : []),
  ];

  const { favorites } = useTeamFavorites();

  const scheduleNavItems = [
    { key: 'nav-my-schedule', title: 'My Schedule', icon: Calendar, path: '/schedule?tab=schedule' },
    ...(isManagerOrPlanner ? [
      { key: 'nav-team-scheduler', title: 'Team Scheduler', icon: CalendarCheck, path: '/schedule?tab=unified-scheduler' }
    ] : []),
  ];

  const commonNavItems = [
    { key: 'nav-requests', title: 'Requests', icon: FileCheck, path: '/schedule?tab=schedule&showRequests=true', badge: pendingRequestsTotal },
  ];

  const managementNavItems = [
    { key: 'nav-holidays', title: 'Holidays', icon: Calendar, path: '/schedule?tab=holidays' },
  ];

  const settingsNavItems = [
    { key: 'nav-profile', title: 'Profile', icon: UserCircle, path: '/schedule?tab=settings' },
    { key: 'nav-manual', title: 'Manual', icon: BookOpen, path: '/manual' },
  ];

  useEffect(() => {
    const favItems = favorites.map(fav => ({
      key: `favorite-${fav.id}`,
      title: fav.name,
      icon: Star,
      path: fav.view_context === 'schedule' 
        ? `/schedule?tab=schedule&favorite=${fav.id}`
        : `/schedule?tab=unified-scheduler&favorite=${fav.id}`,
      favoriteId: fav.id,
      section: 'favorites',
    }));

    const mgmtItems = isManagerOrPlanner ? [
      ...managementNavItems.map(item => ({ ...item, section: 'management' })),
      ...((highestRole === 'planner' || highestRole === 'admin') ? [{
        key: 'nav-admin',
        title: 'Admin Settings',
        icon: Shield,
        path: '/schedule?tab=admin',
        section: 'management',
      }] : [])
    ] : [];

    const combinedItems = [
      ...mainNavItems.map(item => ({ ...item, section: 'overview' })),
      ...scheduleNavItems.map(item => ({ ...item, section: 'schedule' })),
      ...favItems,
      ...commonNavItems.map(item => ({ ...item, section: 'common' })),
      ...mgmtItems,
      ...settingsNavItems.map(item => ({ ...item, section: 'settings' })),
    ];

    setAllItems(getSortedItems(combinedItems));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites, isManagerOrPlanner, highestRole]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = allItems.findIndex((item) => item.key === active.id);
    const newIndex = allItems.findIndex((item) => item.key === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(allItems, oldIndex, newIndex);
      setAllItems(newItems);
      updateOrder(newItems.map(item => item.key));
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={allItems.map(item => item.key)}
            strategy={verticalListSortingStrategy}
          >
            <SidebarMenu>
              {allItems.map((item) => (
                <DraggableSidebarMenuItem
                  key={item.key}
                  id={item.key}
                  onClick={() => navigate(item.path)}
                  isActive={
                    item.path.includes('?') 
                      ? location.pathname + location.search === item.path
                      : isActive(item.path)
                  }
                  tooltip={item.title}
                  icon={<item.icon className="h-4 w-4" />}
                  label={item.title}
                  badge={item.badge}
                />
              ))}
            </SidebarMenu>
          </SortableContext>
        </DndContext>
      </SidebarContent>

      <SidebarFooter>
        {!isCollapsed && (
          <div className="p-2 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => resetOrder()}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Sidebar Order
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Employee Scheduler
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
