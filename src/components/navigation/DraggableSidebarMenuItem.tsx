import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { ReactNode } from 'react';

interface DraggableSidebarMenuItemProps {
  id: string;
  onClick?: () => void;
  isActive?: boolean;
  tooltip?: string;
  icon?: ReactNode;
  label?: string;
  badge?: number;
}

export function DraggableSidebarMenuItem({
  id,
  onClick,
  isActive,
  tooltip,
  icon,
  label,
  badge,
}: DraggableSidebarMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton
        onClick={onClick}
        isActive={isActive}
        tooltip={tooltip}
        className="cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {icon}
        <span>{label}</span>
        {badge !== undefined && badge > 0 && (
          <Badge variant="destructive" className="ml-auto h-5 w-5 flex items-center justify-center p-0 text-xs">
            {badge > 9 ? '9+' : badge}
          </Badge>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
