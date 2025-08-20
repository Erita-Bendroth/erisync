import React, { useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, sanitizeInput } from "@/lib/validation";

const PasswordSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedNewPassword = sanitizeInput(formData.newPassword);
    const sanitizedConfirmPassword = sanitizeInput(formData.confirmPassword);

    if (sanitizedNewPassword !== sanitizedConfirmPassword) {
      toast({ title: "Error", description: "New passwords don't match", variant: "destructive" });
      return;
    }

    const { isValid, errors } = validatePassword(sanitizedNewPassword);
    if (!isValid) {
      toast({ title: "Error", description: errors.join(', '), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.refreshSession();
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password: sanitizedNewPassword
      });

      if (passwordError) throw passwordError;

      toast({ title: "Success", description: "Password changed successfully" });
      setOpen(false);
      setFormData({ newPassword: "", confirmPassword: "" });

    } catch (error: any) {
      console.error('Password change error:', error);
      toast({ title: "Error", description: error.message || "Failed to change password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Lock className="w-5 h-5 mr-2" />
          Password Settings
        </CardTitle>
        <CardDescription>
          Change your password to keep your account secure
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Change Password</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Choose a new secure password
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, numbers, and special characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Changing..." : "Change Password"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PasswordSettings;
