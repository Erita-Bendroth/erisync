import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  CheckSquare, 
  Copy, 
  ClipboardPaste, 
  Trash2,
  Sun,
  Moon,
  Calendar,
  Clock,
  Sunrise,
  Sunset,
  Wand2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShiftTypeOption } from '@/hooks/useShiftTypes';

interface QuickActionsToolbarProps {
  hasSelection: boolean;
  hasClipboard: boolean;
  shiftTypes: ShiftTypeOption[];
  onSelectAll: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
  onQuickAssign: (shiftType: string) => void;
  onApplyTemplate?: () => void;
}

export const QuickActionsToolbar: React.FC<QuickActionsToolbarProps> = ({
  hasSelection,
  hasClipboard,
  shiftTypes,
  onSelectAll,
  onCopy,
  onPaste,
  onClear,
  onQuickAssign,
  onApplyTemplate,
}) => {
  return (
    <div className="flex items-center gap-2 p-2 border-b border-border bg-card">
      <Button
        variant="outline"
        size="sm"
        onClick={onSelectAll}
      >
        <CheckSquare className="h-4 w-4 mr-2" />
        Select All Team
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        variant="outline"
        size="sm"
        onClick={onCopy}
        disabled={!hasSelection}
      >
        <Copy className="h-4 w-4 mr-2" />
        Copy
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onPaste}
        disabled={!hasClipboard || !hasSelection}
      >
        <ClipboardPaste className="h-4 w-4 mr-2" />
        Paste
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasSelection}
          >
            <Clock className="h-4 w-4 mr-2" />
            Quick Assign
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {shiftTypes.map((shift) => {
            const Icon = getShiftIcon(shift.type);
            return (
              <DropdownMenuItem 
                key={shift.id}
                onClick={() => onQuickAssign(shift.type)}
              >
                <Icon className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span>{shift.label}</span>
                  {shift.startTime && shift.endTime && (
                    <span className="text-xs text-muted-foreground">
                      {shift.startTime}-{shift.endTime}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        onClick={onClear}
        disabled={!hasSelection}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Clear
      </Button>

      {onApplyTemplate && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            onClick={onApplyTemplate}
            disabled={!hasSelection}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Apply Template
          </Button>
        </>
      )}
    </div>
  );
};

const getShiftIcon = (shiftType: string) => {
  switch (shiftType) {
    case 'early':
      return Sunrise;
    case 'late':
      return Sunset;
    case 'normal':
      return Sun;
    case 'weekend':
      return Calendar;
    default:
      return Clock;
  }
};
