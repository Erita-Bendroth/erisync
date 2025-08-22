import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Role {
  id: string;
  role: string;
}

interface RoleManagementProps {
  userId: string;
  userName: string;
  roles: Role[];
  onRoleRemoved: () => void;
  canRemove: boolean;
  manageableRoles?: string[];
}

const RoleManagement: React.FC<RoleManagementProps> = ({
  userId,
  userName,
  roles,
  onRoleRemoved,
  canRemove,
  manageableRoles = []
}) => {
  const { toast } = useToast();

  const removeRole = async (roleId: string, roleName: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast({
        title: "Role Removed",
        description: `${roleName} role removed from ${userName}`,
      });

      onRoleRemoved();
    } catch (error: any) {
      console.error('Error removing role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove role",
        variant: "destructive",
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "planner":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "manager":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "teammember":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const canRemoveRole = (role: string) => {
    if (!canRemove) return false;
    // If manageableRoles is empty, user can manage all roles (admin/planner)
    if (manageableRoles.length === 0) return true;
    // Otherwise, only allow managing roles in the manageableRoles list
    return manageableRoles.includes(role);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((roleObj) => (
        <div key={roleObj.id} className="flex items-center gap-1">
          <Badge className={getRoleColor(roleObj.role)}>
            {roleObj.role}
            {canRemoveRole(roleObj.role) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-1 h-auto p-0 hover:bg-transparent"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Role</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove the "{roleObj.role}" role from {userName}?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => removeRole(roleObj.id, roleObj.role)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove Role
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </Badge>
        </div>
      ))}
    </div>
  );
};

export default RoleManagement;