import { useAuth } from "./auth/AuthProvider";
import { Calendar } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { UserMenu } from "@/components/navigation/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearch } from "./search/GlobalSearch";
import { ThemeToggle } from "./theme/ThemeToggle";
import { useHolidaySync } from "@/hooks/useHolidaySync";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileNavigation } from "@/components/mobile/MobileNavigation";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  useHolidaySync();

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col w-full">
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <div className="flex h-16 items-center px-4 gap-4">
              <SidebarTrigger />
              
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span className="font-semibold hidden sm:inline">Employee Scheduler</span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <GlobalSearch />
                <NotificationBell />
                <ThemeToggle />
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="flex-1 container mx-auto py-6 px-4 pb-20 md:pb-6">
            {children}
          </main>

          {isMobile && <MobileNavigation />}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
