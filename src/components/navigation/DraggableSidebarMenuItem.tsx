import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
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
    <SidebarMenuItem ref={setNodeRef} style={style} className="group">
      <SidebarMenuButton
        onClick={onClick}
        isActive={isActive}
        tooltip={tooltip}
        className="cursor-pointer"
      >
        <div
          {...attributes}
          {...listeners}
          className="flex items-center mr-2 cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {icon}
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
