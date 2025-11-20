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
  ArrowDownUp,
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
import { useAuth } from '@/components/auth/AuthProvider';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';
import { useTeamFavorites } from '@/hooks/useTeamFavorites';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { DraggableSidebarMenuItem } from './DraggableSidebarMenuItem';
import { useSidebarOrder } from '@/hooks/useSidebarOrder';
import { Button } from '@/components/ui/button';

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const { getSortedItems, updateOrder, resetOrder, isReorderMode, setIsReorderMode } = useSidebarOrder();

  // State for temporarily reordered items during drag
  const [overviewItems, setOverviewItems] = useState<any[]>([]);
  const [scheduleItems, setScheduleItems] = useState<any[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<any[]>([]);
  const [managementItems, setManagementItems] = useState<any[]>([]);
  const [settingsItems, setSettingsItems] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (data) setUserRole(data.role);
    };

    fetchUserRole();
  }, [user]);

  const isCollapsed = state === 'collapsed';
  const isActive = (path: string) => location.pathname === path;

  const mainNavItems = [
    { key: 'nav-dashboard', title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { key: 'nav-analytics', title: 'Analytics', icon: BarChart3, path: '/analytics' },
  ];

  const { favorites } = useTeamFavorites();

  const scheduleNavItems = [
    { key: 'nav-my-schedule', title: 'My Schedule', icon: Calendar, path: '/schedule?tab=schedule' },
    { key: 'nav-team-scheduler', title: 'Team Scheduler', icon: CalendarCheck, path: '/schedule?tab=unified-scheduler' },
  ];

  const managementNavItems = [
    { key: 'nav-vacations', title: 'Vacations', icon: FileCheck, path: '/schedule?tab=vacations' },
    { key: 'nav-swaps', title: 'Swap Requests', icon: Users, path: '/schedule?tab=swaps' },
    { key: 'nav-holidays', title: 'Holidays', icon: Calendar, path: '/schedule?tab=holidays' },
  ];

  const settingsNavItems = [
    { key: 'nav-profile', title: 'Profile', icon: UserCircle, path: '/schedule?tab=settings' },
    { key: 'nav-manual', title: 'Manual', icon: BookOpen, path: '/manual' },
  ];

  const isManagerOrPlanner = userRole === 'manager' || userRole === 'planner' || userRole === 'admin';

  // Update items when favorites change or sorting changes
  useEffect(() => {
    setOverviewItems(getSortedItems(mainNavItems, 'overview'));
    setScheduleItems(getSortedItems(scheduleNavItems, 'schedule'));
    
    const favItems = favorites.map(fav => ({
      key: `favorite-${fav.id}`,
      title: fav.name,
      icon: Star,
      path: `/schedule?tab=unified-scheduler&favorite=${fav.id}`,
      favoriteId: fav.id,
    }));
    setFavoriteItems(getSortedItems(favItems, 'favorites'));

    if (isManagerOrPlanner) {
      const mgmtItems = [
        ...managementNavItems,
        ...(userRole === 'planner' || userRole === 'admin' ? [{
          key: 'nav-admin',
          title: 'Admin Settings',
          icon: Shield,
          path: '/schedule?tab=admin',
        }] : [])
      ];
      setManagementItems(getSortedItems(mgmtItems, 'management'));
    }

    setSettingsItems(getSortedItems(settingsNavItems, 'settings'));
  }, [favorites, getSortedItems, isManagerOrPlanner, userRole]);

  const handleDragEnd = (event: DragEndEvent, section: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    let items: any[];
    let setItems: (items: any[]) => void;

    switch (section) {
      case 'overview':
        items = overviewItems;
        setItems = setOverviewItems;
        break;
      case 'schedule':
        items = scheduleItems;
        setItems = setScheduleItems;
        break;
      case 'favorites':
        items = favoriteItems;
        setItems = setFavoriteItems;
        break;
      case 'management':
        items = managementItems;
        setItems = setManagementItems;
        break;
      case 'settings':
        items = settingsItems;
        setItems = setSettingsItems;
        break;
      default:
        return;
    }

    const oldIndex = items.findIndex((item) => item.key === active.id);
    const newIndex = items.findIndex((item) => item.key === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      updateOrder(section, newItems.map(item => item.key));
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Overview Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, 'overview')}
            >
              <SortableContext
                items={overviewItems.map(item => item.key)}
                strategy={verticalListSortingStrategy}
              >
                <SidebarMenu>
                  {overviewItems.map((item) => (
                    <DraggableSidebarMenuItem
                      key={item.key}
                      id={item.key}
                      isReorderMode={isReorderMode}
                      onClick={() => navigate(item.path)}
                      isActive={isActive(item.path)}
                      tooltip={item.title}
                      icon={<item.icon className="h-4 w-4" />}
                      label={item.title}
                    />
                  ))}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        {/* Schedule Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Schedule</SidebarGroupLabel>
          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, 'schedule')}
            >
              <SortableContext
                items={scheduleItems.map(item => item.key)}
                strategy={verticalListSortingStrategy}
              >
                <SidebarMenu>
                  {scheduleItems.map((item) => (
                    <DraggableSidebarMenuItem
                      key={item.key}
                      id={item.key}
                      isReorderMode={isReorderMode}
                      onClick={() => navigate(item.path)}
                      isActive={location.pathname + location.search === item.path}
                      tooltip={item.title}
                      icon={<item.icon className="h-4 w-4" />}
                      label={item.title}
                    />
                  ))}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Access / Favorites Section */}
        {favoriteItems.length > 0 && (
          <>
            <Separator />
            <SidebarGroup>
              <SidebarGroupLabel>Quick Access</SidebarGroupLabel>
              <SidebarGroupContent>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleDragEnd(event, 'favorites')}
                >
                  <SortableContext
                    items={favoriteItems.map(item => item.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    <SidebarMenu>
                      {favoriteItems.map((item) => (
                        <DraggableSidebarMenuItem
                          key={item.key}
                          id={item.key}
                          isReorderMode={isReorderMode}
                          onClick={() => navigate(item.path)}
                          tooltip={item.title}
                          icon={<item.icon className="h-4 w-4" />}
                          label={item.title}
                        />
                      ))}
                    </SidebarMenu>
                  </SortableContext>
                </DndContext>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Management Section (for managers/planners only) */}
        {isManagerOrPlanner && (
          <>
            <Separator />
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleDragEnd(event, 'management')}
                >
                  <SortableContext
                    items={managementItems.map(item => item.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    <SidebarMenu>
                      {managementItems.map((item) => (
                        <DraggableSidebarMenuItem
                          key={item.key}
                          id={item.key}
                          isReorderMode={isReorderMode}
                          onClick={() => navigate(item.path)}
                          isActive={location.pathname + location.search === item.path}
                          tooltip={item.title}
                          icon={<item.icon className="h-4 w-4" />}
                          label={item.title}
                        />
                      ))}
                    </SidebarMenu>
                  </SortableContext>
                </DndContext>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Settings Section */}
        <Separator />
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, 'settings')}
            >
              <SortableContext
                items={settingsItems.map(item => item.key)}
                strategy={verticalListSortingStrategy}
              >
                <SidebarMenu>
                  {settingsItems.map((item) => (
                    <DraggableSidebarMenuItem
                      key={item.key}
                      id={item.key}
                      isReorderMode={isReorderMode}
                      onClick={() => navigate(item.path)}
                      isActive={location.pathname + location.search === item.path}
                      tooltip={item.title}
                      icon={<item.icon className="h-4 w-4" />}
                      label={item.title}
                    />
                  ))}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!isCollapsed && (
          <div className="p-2 space-y-2">
            <Button
              variant={isReorderMode ? "default" : "outline"}
              size="sm"
              className="w-full justify-start"
              onClick={() => setIsReorderMode(!isReorderMode)}
            >
              <ArrowDownUp className="h-4 w-4 mr-2" />
              {isReorderMode ? 'Done Reordering' : 'Reorder Sidebar'}
            </Button>
            {isReorderMode && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => resetOrder()}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Default
              </Button>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Employee Scheduler
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
