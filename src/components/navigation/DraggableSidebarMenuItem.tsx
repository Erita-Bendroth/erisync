import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { ReactNode } from 'react';

interface DraggableSidebarMenuItemProps {
  id: string;
  isReorderMode: boolean;
  onClick?: () => void;
  isActive?: boolean;
  tooltip?: string;
  icon?: ReactNode;
  label?: string;
}

export function DraggableSidebarMenuItem({
  id,
  isReorderMode,
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
  } = useSortable({ id, disabled: !isReorderMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton
        onClick={isReorderMode ? undefined : onClick}
        isActive={isActive}
        tooltip={tooltip}
        className={isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''}
      >
        {isReorderMode && (
          <div
            {...attributes}
            {...listeners}
            className="flex items-center mr-2 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {icon}
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
