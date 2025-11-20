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
  const { getSortedItems, updateOrder, resetOrder } = useSidebarOrder();

  // Single state for all items (allows dragging between sections)
  const [allItems, setAllItems] = useState<any[]>([]);

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

  // Merge all items into a single array
  useEffect(() => {
    const favItems = favorites.map(fav => ({
      key: `favorite-${fav.id}`,
      title: fav.name,
      icon: Star,
      path: `/schedule?tab=unified-scheduler&favorite=${fav.id}`,
      favoriteId: fav.id,
      section: 'favorites',
    }));

    const mgmtItems = isManagerOrPlanner ? [
      ...managementNavItems.map(item => ({ ...item, section: 'management' })),
      ...(userRole === 'planner' || userRole === 'admin' ? [{
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
      ...mgmtItems,
      ...settingsNavItems.map(item => ({ ...item, section: 'settings' })),
    ];

    setAllItems(getSortedItems(combinedItems));
  }, [favorites, getSortedItems, isManagerOrPlanner, userRole]);

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


  const getSectionLabel = (section: string) => {
    switch (section) {
      case 'overview': return 'Overview';
      case 'schedule': return 'Schedule';
      case 'favorites': return 'Quick Access';
      case 'management': return 'Management';
      case 'settings': return 'Settings';
      default: return section;
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
              {allItems.map((item, index) => {
                const showSectionLabel = 
                  index === 0 || allItems[index - 1].section !== item.section;
                
                return (
                  <div key={item.key}>
                    {showSectionLabel && (
                      <>
                        {index > 0 && <Separator className="my-2" />}
                        <SidebarGroupLabel className="px-2 py-1.5">
                          {getSectionLabel(item.section)}
                        </SidebarGroupLabel>
                      </>
                    )}
                    
                    <DraggableSidebarMenuItem
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
                    />
                  </div>
                );
              })}
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
