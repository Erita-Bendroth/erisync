import React, { useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, FileCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export const MobileNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isNavigating = useRef(false);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Calendar, label: 'Schedule', path: '/schedule' },
    { icon: FileCheck, label: 'Requests', path: '/schedule?tab=vacations' },
    { icon: User, label: 'Profile', path: '/schedule?tab=settings' },
  ];

  const isActive = (path: string) => {
    if (path.includes('?')) {
      const currentFullPath = location.pathname + location.search;
      return currentFullPath === path || currentFullPath.includes(path.split('?')[1]);
    }
    return location.pathname === path;
  };

  const handleNavigation = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    console.log('Mobile nav clicked:', { 
      path, 
      currentPath: location.pathname + location.search, 
      isNavigating: isNavigating.current 
    });
    
    // Prevent double-click spam
    if (isNavigating.current) {
      console.warn('Navigation blocked - already in progress');
      return;
    }
    
    isNavigating.current = true;
    
    try {
      console.log('Navigating to:', path);
      navigate(path, { replace: false });
      console.log('Navigation called successfully');
    } catch (error) {
      console.error('Navigation error:', error);
      toast({
        title: "Navigation Error",
        description: "Failed to navigate. Please try again.",
        variant: "destructive"
      });
    } finally {
      // Reset navigation lock after a delay
      setTimeout(() => {
        isNavigating.current = false;
        console.log('Navigation lock released');
      }, 1000);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <nav className="flex items-center justify-around h-16 safe-area-inset-bottom">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={(e) => handleNavigation(item.path, e)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors touch-manipulation",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
