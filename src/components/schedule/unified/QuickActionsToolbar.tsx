import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  CheckSquare, 
  Copy, 
  ClipboardPaste, 
  Repeat, 
  Trash2,
  Sun,
  Moon,
  Calendar,
  Clock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface QuickActionsToolbarProps {
  hasSelection: boolean;
  hasClipboard: boolean;
  onSelectAll: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
  onQuickAssign: (shiftType: 'early' | 'late' | 'normal' | 'weekend') => void;
}

export const QuickActionsToolbar: React.FC<QuickActionsToolbarProps> = ({
  hasSelection,
  hasClipboard,
  onSelectAll,
  onCopy,
  onPaste,
  onClear,
  onQuickAssign,
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
          <DropdownMenuItem onClick={() => onQuickAssign('early')}>
            <Sun className="h-4 w-4 mr-2" />
            Early Shift
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onQuickAssign('late')}>
            <Moon className="h-4 w-4 mr-2" />
            Late Shift
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onQuickAssign('normal')}>
            <Calendar className="h-4 w-4 mr-2" />
            Day Shift
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onQuickAssign('weekend')}>
            <Calendar className="h-4 w-4 mr-2" />
            Weekend
          </DropdownMenuItem>
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
    </div>
  );
};
