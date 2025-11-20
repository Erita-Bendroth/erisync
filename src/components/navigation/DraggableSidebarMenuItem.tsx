import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { ReactNode } from 'react';

interface DraggableSidebarMenuItemProps {
  id: string;
  onClick?: () => void;
  isActive?: boolean;
  tooltip?: string;
  icon?: ReactNode;
  label?: string;
}

export function DraggableSidebarMenuItem({
  id,
  onClick,
  isActive,
  tooltip,
  icon,
  label,
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
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
