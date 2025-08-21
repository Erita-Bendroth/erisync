import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateEmail, validatePassword, sanitizeInput } from "@/lib/validation";

interface Team {
  id: string;
  name: string;
}

interface UserCreationProps {
  onUserCreated: () => void;
}

const UserCreation: React.FC<UserCreationProps> = ({ onUserCreated }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    initials: "",
    role: "",
    countryCode: "US",
    teamId: "no-team",
  });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    if (!validateEmail(formData.email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!formData.initials || !formData.role) {
      toast({
        title: "Error", 
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Generate a temporary password that meets requirements
      const tempPassword = `TempPass${Math.random().toString(36).slice(-4)}!`;
      
      // Create user account via admin function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: sanitizeInput(formData.email),
          password: tempPassword,
          initials: sanitizeInput(formData.initials),
          role: formData.role,
          countryCode: formData.countryCode,
          teamId: formData.teamId,
          requiresPasswordChange: true
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `User created successfully. They will need to change their password on first login.`,
      });

      // Reset form
      setFormData({
        email: "",
        initials: "",
        role: "",
        countryCode: "US",
        teamId: "no-team",
      });
      
      onUserCreated();
      
    } catch (error: any) {
      console.error('User creation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserPlus className="w-5 h-5 mr-2" />
          Create New User
        </CardTitle>
        <CardDescription>
          Add a new user to the system. They will receive a temporary password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            New users will be required to change their password on first login for security.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="initials">User Initials</Label>
            <Input
              id="initials"
              type="text"
              value={formData.initials}
              onChange={(e) => setFormData({ ...formData, initials: e.target.value.toUpperCase() })}
              placeholder="Enter user initials (e.g. JD)"
              maxLength={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Short initials to identify the user (2-4 characters)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter email address"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select onValueChange={(value) => setFormData({ ...formData, role: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select user role" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-md z-50">
                <SelectItem value="teammember">Team Member</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="planner">Planner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team">Team (Optional)</Label>
            <Select onValueChange={(value) => setFormData({ ...formData, teamId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select team (optional)" />
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
            <Select onValueChange={(value) => setFormData({ ...formData, countryCode: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-md z-50 max-h-60 overflow-y-auto">
                <SelectItem value="AD">Andorra</SelectItem>
                <SelectItem value="AL">Albania</SelectItem>
                <SelectItem value="AT">Austria</SelectItem>
                <SelectItem value="BA">Bosnia and Herzegovina</SelectItem>
                <SelectItem value="BE">Belgium</SelectItem>
                <SelectItem value="BG">Bulgaria</SelectItem>
                <SelectItem value="BY">Belarus</SelectItem>
                <SelectItem value="CH">Switzerland</SelectItem>
                <SelectItem value="CY">Cyprus</SelectItem>
                <SelectItem value="CZ">Czech Republic</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="DK">Denmark</SelectItem>
                <SelectItem value="EE">Estonia</SelectItem>
                <SelectItem value="ES">Spain</SelectItem>
                <SelectItem value="FI">Finland</SelectItem>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
                <SelectItem value="GE">Georgia</SelectItem>
                <SelectItem value="GR">Greece</SelectItem>
                <SelectItem value="HR">Croatia</SelectItem>
                <SelectItem value="HU">Hungary</SelectItem>
                <SelectItem value="IE">Ireland</SelectItem>
                <SelectItem value="IS">Iceland</SelectItem>
                <SelectItem value="IT">Italy</SelectItem>
                <SelectItem value="LI">Liechtenstein</SelectItem>
                <SelectItem value="LT">Lithuania</SelectItem>
                <SelectItem value="LU">Luxembourg</SelectItem>
                <SelectItem value="LV">Latvia</SelectItem>
                <SelectItem value="MC">Monaco</SelectItem>
                <SelectItem value="MD">Moldova</SelectItem>
                <SelectItem value="ME">Montenegro</SelectItem>
                <SelectItem value="MK">North Macedonia</SelectItem>
                <SelectItem value="MT">Malta</SelectItem>
                <SelectItem value="NL">Netherlands</SelectItem>
                <SelectItem value="NO">Norway</SelectItem>
                <SelectItem value="PL">Poland</SelectItem>
                <SelectItem value="PT">Portugal</SelectItem>
                <SelectItem value="RO">Romania</SelectItem>
                <SelectItem value="RS">Serbia</SelectItem>
                <SelectItem value="RU">Russia</SelectItem>
                <SelectItem value="SE">Sweden</SelectItem>
                <SelectItem value="SI">Slovenia</SelectItem>
                <SelectItem value="SK">Slovakia</SelectItem>
                <SelectItem value="SM">San Marino</SelectItem>
                <SelectItem value="TR">Turkey</SelectItem>
                <SelectItem value="UA">Ukraine</SelectItem>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
                <SelectItem value="VA">Vatican City</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating User..." : "Create User"}
            <Users className="w-4 h-4 ml-2" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default UserCreation;