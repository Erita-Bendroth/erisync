import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  selectedCount: number;
  onApprove?: () => void;
  onReject?: () => void;
  onClear: () => void;
  approveLabel?: string;
  rejectLabel?: string;
  isProcessing?: boolean;
  className?: string;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onApprove,
  onReject,
  onClear,
  approveLabel = 'Approve Selected',
  rejectLabel = 'Reject Selected',
  isProcessing = false,
  className,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "shadow-lg",
        className
      )}
    >
      <div className="container max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
              {selectedCount}
            </div>
            <span className="text-sm font-medium">
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onApprove && (
              <Button
                onClick={onApprove}
                disabled={isProcessing}
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {approveLabel}
              </Button>
            )}

            {onReject && (
              <Button
                onClick={onReject}
                disabled={isProcessing}
                variant="destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {rejectLabel}
              </Button>
            )}

            <Button
              onClick={onClear}
              disabled={isProcessing}
              variant="outline"
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
