import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeInput, validateEmail } from "@/lib/validation";

const countries = [
  // European Countries (sorted alphabetically)
  { code: "AD", name: "Andorra" },
  { code: "AL", name: "Albania" },
  { code: "AT", name: "Austria" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "BY", name: "Belarus" },
  { code: "CH", name: "Switzerland" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DE", name: "Germany" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "ES", name: "Spain" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "GR", name: "Greece" },
  { code: "HR", name: "Croatia" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IS", name: "Iceland" },
  { code: "IT", name: "Italy" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "LV", name: "Latvia" },
  { code: "MC", name: "Monaco" },
  { code: "MD", name: "Moldova" },
  { code: "ME", name: "Montenegro" },
  { code: "MK", name: "North Macedonia" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "RS", name: "Serbia" },
  { code: "RU", name: "Russia" },
  { code: "SE", name: "Sweden" },
  { code: "SI", name: "Slovenia" },
  { code: "SK", name: "Slovakia" },
  { code: "SM", name: "San Marino" },
  { code: "UA", name: "Ukraine" },
  { code: "VA", name: "Vatican City" },
  { code: "XK", name: "Kosovo" },
  // Non-European but commonly used
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
];

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

    if (!formData.role) {
      toast({
        title: "Error", 
        description: "Role is required",
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
          <div className="space-y-2">
            <Label htmlFor="initials">User Initials</Label>
            <Input
              id="initials"
              value={`${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`.toUpperCase()}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Generated from first and last name
            </p>
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
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
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