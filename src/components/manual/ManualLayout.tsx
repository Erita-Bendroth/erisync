import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ManualLayoutProps {
  children: ReactNode;
  role: string;
}

export const ManualLayout = ({ children, role }: ManualLayoutProps) => {
  const getRoleBadgeVariant = () => {
    switch (role) {
      case "planner":
        return "default";
      case "manager":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case "planner":
        return "Planner";
      case "manager":
        return "Manager";
      default:
        return "Team Member";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant={getRoleBadgeVariant()}>
          {getRoleLabel()} Manual
        </Badge>
      </div>

      <Card>
        <CardContent className="p-6">
          <ScrollArea className="h-[70vh]">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {children}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
