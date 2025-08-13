import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, sanitizeInput } from "@/lib/validation";
import { useAuth } from "./AuthProvider";

interface PasswordChangeModalProps {
  isOpen: boolean;
  onPasswordChanged: () => void;
}

const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ isOpen, onPasswordChanged }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Clear form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      console.log('Modal opened, form cleared');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Remove the constant re-render debugging
  // console.log('PasswordChangeModal rendered, isOpen:', isOpen);
  // console.log('User from context:', user ? { id: user.id, email: user.email } : 'null');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Password change form submitted');
    
    // Check if user is available from context
    if (!user) {
      console.error('No user found in auth context during password change');
      toast({
        title: "Error",
        description: "Please sign in again to change your password.",
        variant: "destructive",
      });
      return;
    }

    console.log('User found in context:', user.id, user.email);

    // Check and refresh the Supabase session
    try {
      console.log('Checking current session...');
      
      // Force refresh the session before password change
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      console.log('Session refresh result:', {
        hasSession: !!refreshData.session,
        hasUser: !!refreshData.user,
        error: refreshError
      });
      
      if (!refreshData.session || refreshError) {
        console.error('Session refresh failed:', refreshError);
        toast({
          title: "Error", 
          description: "Your session has expired. Please sign in again.",
          variant: "destructive",
        });
        return;
      }
      
      // Verify the refreshed session works
      const { data: { user: sessionUser }, error: userError } = await supabase.auth.getUser();
      if (!sessionUser || userError) {
        console.error('Session verification failed:', userError);
        toast({
          title: "Error",
          description: "Authentication error. Please sign in again.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Session refreshed and verified successfully');
    } catch (error) {
      console.error('Session refresh error:', error);
      toast({
        title: "Error",
        description: "Authentication error. Please sign in again.",
        variant: "destructive",
      });
      return;
    }

    // Sanitize inputs
    const sanitizedCurrentPassword = sanitizeInput(formData.currentPassword);
    const sanitizedNewPassword = sanitizeInput(formData.newPassword);
    const sanitizedConfirmPassword = sanitizeInput(formData.confirmPassword);

    // Validate current password is provided
    if (!sanitizedCurrentPassword) {
      toast({
        title: "Error",
        description: "Current password is required",
        variant: "destructive",
      });
      return;
    }
    
    if (sanitizedNewPassword !== sanitizedConfirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive",
      });
      return;
    }

    // Validate new password strength
    const { isValid, errors } = validatePassword(sanitizedNewPassword);
    if (!isValid) {
      toast({
        title: "Error",
        description: errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Verify current password
      const { data: verificationData, error: verificationError } = await supabase.functions.invoke('verify-password', {
        body: {
          email: user.email,
          currentPassword: sanitizedCurrentPassword
        }
      });

      if (verificationError || !verificationData?.valid) {
        toast({
          title: "Error",
          description: "Current password is incorrect",
          variant: "destructive",
        });
        return;
      }

      // Update password using Supabase auth
      const { error: passwordError } = await supabase.auth.updateUser({
        password: sanitizedNewPassword
      });

      if (passwordError) throw passwordError;

      // Update profile to remove password change requirement
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ requires_password_change: false })
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw profileError;
      }

      toast({
        title: "Success",
        description: "Password changed successfully",
      });

      onPasswordChanged();
      
    } catch (error: any) {
      console.error('Password change error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            Password Change Required
          </CardTitle>
          <CardDescription>
            You must change your password before continuing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You are required to change your password before continuing.
              <br />
              Please choose a secure password with at least 8 characters.
            </AlertDescription>
          </Alert>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                placeholder="Enter your current password"
                required
              />
            </div>

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

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Changing Password..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordChangeModal;