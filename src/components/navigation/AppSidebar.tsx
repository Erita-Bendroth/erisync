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
  UserCircle
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

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);

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
    { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { title: 'Analytics', icon: BarChart3, path: '/analytics' },
  ];

  const scheduleNavItems = [
    { title: 'My Schedule', icon: Calendar, path: '/schedule?tab=schedule' },
    { title: 'Team Scheduler', icon: CalendarCheck, path: '/schedule?tab=unified-scheduler' },
  ];

  const managementNavItems = [
    { title: 'Vacations', icon: FileCheck, path: '/schedule?tab=vacations' },
    { title: 'Swap Requests', icon: Users, path: '/schedule?tab=swaps' },
    { title: 'Holidays', icon: Calendar, path: '/schedule?tab=holidays' },
  ];

  const settingsNavItems = [
    { title: 'Profile', icon: UserCircle, path: '/schedule?tab=settings' },
    { title: 'Manual', icon: BookOpen, path: '/manual' },
  ];

  const isManagerOrPlanner = userRole === 'manager' || userRole === 'planner' || userRole === 'admin';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Overview Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={isActive(item.path)}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        {/* Schedule Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Schedule</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {scheduleNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={location.pathname + location.search === item.path}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management Section (for managers/planners only) */}
        {isManagerOrPlanner && (
          <>
            <Separator />
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {managementNavItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.path)}
                        isActive={location.pathname + location.search === item.path}
                        tooltip={item.title}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {(userRole === 'planner' || userRole === 'admin') && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate('/schedule?tab=admin')}
                        isActive={location.search.includes('tab=admin')}
                        tooltip="Admin Settings"
                      >
                        <Shield className="h-4 w-4" />
                        <span>Admin Settings</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Settings Section */}
        <Separator />
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={location.pathname + location.search === item.path}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="p-2 text-xs text-muted-foreground text-center">
          {!isCollapsed && (
            <p>Employee Scheduler</p>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
