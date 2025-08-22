import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeInput, validateEmail } from "@/lib/validation";

interface Team {
  id: string;
  name: string;
}

interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  country_code: string;
  requires_password_change: boolean;
  roles: string[];
  teams: Team[];
}

interface EditUserModalProps {
  user: User | null;
  teams: Team[];
  availableRoles: string[];
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ 
  user, 
  teams, 
  availableRoles,
  isOpen, 
  onClose, 
  onUserUpdated 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.first_name || "",
    lastName: user?.last_name || "",
    email: user?.email || "",
    countryCode: user?.country_code || "US",
    role: user?.roles?.[0] || "",
    teamId: user?.teams?.[0]?.id || "no-team",
  });

  // Reset form data when user changes
  React.useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        email: user.email || "",
        countryCode: user.country_code || "US",
        role: user.roles?.[0] || "",
        teamId: user.teams?.[0]?.id || "no-team",
      });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Validate input
    if (!validateEmail(formData.email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!formData.firstName || !formData.lastName || !formData.role) {
      toast({
        title: "Error", 
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: sanitizeInput(formData.firstName),
          last_name: sanitizeInput(formData.lastName),
          email: sanitizeInput(formData.email),
          country_code: formData.countryCode,
        })
        .eq('user_id', user.user_id);

      if (profileError) throw profileError;

      // Update role if changed
      if (formData.role !== user.roles?.[0]) {
        // Delete old role
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.user_id);

        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: user.user_id,
            role: formData.role as 'admin' | 'planner' | 'manager' | 'teammember'
          });

        if (roleError) throw roleError;
      }

      // Update team assignment if changed
      const currentTeamId = user.teams?.[0]?.id || "no-team";
      if (formData.teamId !== currentTeamId) {
        // Remove from old team
        await supabase
          .from('team_members')
          .delete()
          .eq('user_id', user.user_id);

        // Add to new team if not "no-team"
        if (formData.teamId !== "no-team") {
          const { error: teamError } = await supabase
            .from('team_members')
            .insert({
              user_id: user.user_id,
              team_id: formData.teamId,
              is_manager: formData.role === 'manager'
            });

          if (teamError) throw teamError;
        }
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      onUserUpdated();
      onClose();
      
    } catch (error: any) {
      console.error('User update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Make changes to the user's profile and settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-md z-50">
                {availableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role === 'teammember' ? 'Team Member' : 
                     role === 'manager' ? 'Manager' : 
                     role === 'planner' ? 'Planner' : 
                     role === 'admin' ? 'Admin' : role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team">Team</Label>
            <Select value={formData.teamId} onValueChange={(value) => setFormData({ ...formData, teamId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-md z-50">
                <SelectItem value="no-team">No Team</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select value={formData.countryCode} onValueChange={(value) => setFormData({ ...formData, countryCode: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-md z-50 max-h-60 overflow-y-auto">
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="DK">Denmark</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="ES">Spain</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
                <SelectItem value="IN">India</SelectItem>
                <SelectItem value="CN">China</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
                <SelectItem value="PL">Poland</SelectItem>
                <SelectItem value="RO">Romania</SelectItem>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="IT">Italy</SelectItem>
                <SelectItem value="NL">Netherlands</SelectItem>
                <SelectItem value="SE">Sweden</SelectItem>
                <SelectItem value="NO">Norway</SelectItem>
                <SelectItem value="FI">Finland</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="BR">Brazil</SelectItem>
                <SelectItem value="MX">Mexico</SelectItem>
                <SelectItem value="AR">Argentina</SelectItem>
                <SelectItem value="CL">Chile</SelectItem>
                <SelectItem value="PE">Peru</SelectItem>
                <SelectItem value="CO">Colombia</SelectItem>
                <SelectItem value="UY">Uruguay</SelectItem>
                <SelectItem value="TR">Turkey</SelectItem>
                <SelectItem value="GR">Greece</SelectItem>
                <SelectItem value="PT">Portugal</SelectItem>
                <SelectItem value="JP">Japan</SelectItem>
                <SelectItem value="KR">South Korea</SelectItem>
                <SelectItem value="TW">Taiwan</SelectItem>
                <SelectItem value="VN">Vietnam</SelectItem>
                <SelectItem value="PH">Philippines</SelectItem>
                <SelectItem value="TH">Thailand</SelectItem>
                <SelectItem value="MY">Malaysia</SelectItem>
                <SelectItem value="SG">Singapore</SelectItem>
                <SelectItem value="ID">Indonesia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserModal;