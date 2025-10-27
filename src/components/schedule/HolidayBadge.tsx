import { Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HolidayBadgeProps {
  holidayName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function HolidayBadge({ holidayName, size = "md", className }: HolidayBadgeProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("inline-flex items-center justify-center", className)}>
            <Calendar className={cn(sizeClasses[size], "text-purple-500")} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">🎉 {holidayName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
