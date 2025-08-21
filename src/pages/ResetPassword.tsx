import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, sanitizeInput } from "@/lib/validation";

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [sessionReady, setSessionReady] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);

  useEffect(() => {
    const setupRecoverySession = async () => {
      try {
        console.log('=== DEBUGGING PASSWORD RECOVERY ===');
        setInitializing(true);
        setError(null);

        // Step 1: Extract tokens from URL
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        
        const access_token = hashParams.get('access_token') || searchParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');

        console.log('URL Tokens:', {
          hasAccessToken: !!access_token,
          hasRefreshToken: !!refresh_token,
          type: type,
          urlHash: window.location.hash,
          urlSearch: window.location.search
        });

        if (!access_token || !refresh_token || type !== 'recovery') {
          throw new Error('Invalid password reset link. Missing required tokens or type != recovery');
        }

        // Step 2: Set session using recovery tokens
        console.log('Setting session with tokens...');
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: access_token,
          refresh_token: refresh_token
        });

        // Clear URL after establishing session to prevent token leakage
        window.history.replaceState({}, document.title, window.location.pathname);

        if (sessionError) {
          console.error('Session error:', sessionError);
          throw new Error(`Session setup failed: ${sessionError.message}`);
        }

        if (!sessionData.session) {
          throw new Error('No session returned from setSession()');
        }

        console.log('Session created:', {
          userId: sessionData.session.user?.id,
          expiresAt: sessionData.session.expires_at,
          hasUser: !!sessionData.session.user
        });

        // Step 4: Verify session is actually active
        const { data: verifyData, error: verifyError } = await supabase.auth.getSession();
        if (verifyError || !verifyData.session) {
          console.error('Session verification failed:', verifyError);
          throw new Error('Session not properly established');
        }

        console.log('Session verified successfully');
        setActiveSession(verifyData.session);
        setSessionReady(true);

      } catch (err: any) {
        console.error('Recovery setup failed:', err);
        setError(err.message || 'Failed to initialize password recovery');
        setSessionReady(false);
        setActiveSession(null);
      } finally {
        setInitializing(false);
      }
    };

    setupRecoverySession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    console.log('=== DEBUGGING PASSWORD UPDATE ===');

    if (!sessionReady) {
      setError("Recovery session not ready. Please try again.");
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
      // Verify we still have the active session
      if (!activeSession) {
        console.error('No stored session found');
        throw new Error('Session expired. Please request a new password reset link.');
      }

      console.log('Using stored session for password update:', {
        userId: activeSession.user?.id,
        expiresAt: activeSession.expires_at
      });

      // Update password using the stored session
      console.log('Updating password...');
      const { error: updateError } = await supabase.auth.updateUser({
        password: sanitizeInput(form.newPassword)
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        throw new Error(`Password update failed: ${updateError.message}`);
      }

      console.log('Password updated successfully');

      // Sign out to clear recovery session
      console.log('Signing out recovery session...');
      await supabase.auth.signOut();

      setSuccess(true);
      toast({ 
        title: "Password Reset Complete", 
        description: "Your password has been updated successfully. Please sign in with your new password." 
      });

      // Redirect after delay
      setTimeout(() => {
        navigate("/auth", { replace: true });
      }, 2000);
      
    } catch (err: any) {
      console.error("Password update process failed:", err);
      setError(err.message || "Failed to update password. Please try again or request a new reset link.");
    } finally {
      setLoading(false);
    }
  };

  // Show initialization loading
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Setting up password recovery...</p>
            <p className="text-xs text-muted-foreground mt-2">Please wait while we validate your reset link</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              Password Updated Successfully
            </CardTitle>
            <CardDescription>
              You can now sign in with your new password
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Redirecting to login page...
            </p>
            <Button onClick={() => navigate("/auth", { replace: true })} className="w-full">
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
            Set New Password
          </CardTitle>
          <CardDescription>
            Enter and confirm your new password
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Debug Error:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {!sessionReady ? (
            <div className="text-center py-4">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Password Reset Link Invalid</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                This password reset link is invalid, expired, or has already been used.
              </p>
              <Button onClick={() => navigate("/auth", { replace: true })} variant="outline" className="w-full">
                Request New Password Reset
              </Button>
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
                  Must be at least 8 characters long
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
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
                <Button type="submit" disabled={loading || !sessionReady} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
                
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full"
                  onClick={() => navigate("/auth", { replace: true })}
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