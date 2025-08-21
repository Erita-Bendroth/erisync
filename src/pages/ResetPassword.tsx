import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, sanitizeInput } from "@/lib/validation";

interface RecoveryTokens {
  access_token: string | null;
  refresh_token: string | null;
  type: string | null;
}

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [recoveryTokens, setRecoveryTokens] = useState<RecoveryTokens>({ 
    access_token: null, 
    refresh_token: null, 
    type: null 
  });
  const [validRecoveryLink, setValidRecoveryLink] = useState(false);

  useEffect(() => {
    // Parse recovery tokens from URL (hash and query parameters)
    const parseRecoveryTokens = () => {
      // Check URL hash first (Supabase typically uses hash)
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      
      // Check query parameters as fallback
      const queryParams = searchParams;
      
      const tokens: RecoveryTokens = {
        access_token: hashParams.get('access_token') || queryParams.get('access_token'),
        refresh_token: hashParams.get('refresh_token') || queryParams.get('refresh_token'),
        type: hashParams.get('type') || queryParams.get('type')
      };

      console.log('Parsed recovery tokens:', { 
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        type: tokens.type,
        source: hashParams.get('access_token') ? 'hash' : 'query'
      });

      return tokens;
    };

    const tokens = parseRecoveryTokens();
    setRecoveryTokens(tokens);

    // Validate that this is a valid recovery link
    if (tokens.access_token && tokens.type === 'recovery') {
      setValidRecoveryLink(true);
      // Clean the URL to avoid token leakage in browser history
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      setValidRecoveryLink(false);
      setError("Invalid or expired password reset link. Please request a new password reset email.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validRecoveryLink || !recoveryTokens.access_token) {
      setError("Invalid recovery session. Please request a new password reset link.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const { isValid, errors } = validatePassword(form.newPassword);
    if (!isValid) {
      setError(errors.join(", "));
      return;
    }

    setLoading(true);
    
    try {
      // Create a temporary session using the recovery tokens for password update
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: recoveryTokens.access_token!,
        refresh_token: recoveryTokens.refresh_token!,
      });

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        throw new Error('Invalid or expired recovery link. Please request a new password reset.');
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: sanitizeInput(form.newPassword)
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        throw updateError;
      }

      // Sign out after successful password update to prevent automatic login
      await supabase.auth.signOut();

      setSuccess(true);
      toast({ 
        title: "Password Reset Successful", 
        description: "Your password has been updated. Please sign in with your new password." 
      });

      // Redirect to login page after a short delay
      setTimeout(() => {
        navigate("/auth");
      }, 2000);
      
    } catch (err: any) {
      console.error("Password reset error:", err);
      setError(err.message || "Failed to update password. Please try again or request a new reset link.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              Password Reset Complete
            </CardTitle>
            <CardDescription>
              Your password has been successfully updated
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              You will be redirected to the login page shortly.
            </p>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Go to Login Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Reset Your Password
          </CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!validRecoveryLink ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                This password reset link is invalid or has expired.
              </p>
              <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">
                Go to Login Page
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                You can request a new password reset from the login page
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  placeholder="Enter your new password"
                  required
                  minLength={8}
                  disabled={loading}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters long
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Confirm your new password"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
              
              <div className="space-y-3">
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Updating Password..." : "Update Password"}
                </Button>
                
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full"
                  onClick={() => navigate("/auth")}
                  disabled={loading}
                >
                  Back to Login
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;