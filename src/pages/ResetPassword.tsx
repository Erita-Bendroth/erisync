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
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let timeoutId: any;

    const init = async () => {
      try {
        setSessionLoading(true);
        setError(null);

        // Read params (hash preferred)
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const queryParams = searchParams;
        const type = hashParams.get('type') || queryParams.get('type');
        const code = queryParams.get('code');

        // If using code flow, exchange for session
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data.session) {
            setHasValidSession(true);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }

        // Subscribe for PASSWORD_RECOVERY or SIGNED_IN (recovery) events
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && type === 'recovery') {
            setHasValidSession(true);
            if (window.location.hash) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        });
        unsubscribe = sub.subscription.unsubscribe;

        // Also check for an already-present session
        const { data } = await supabase.auth.getSession();
        if (data.session && type === 'recovery') {
          setHasValidSession(true);
          setSessionLoading(false);
          return;
        }

        // Fallback: wait briefly for event to arrive
        timeoutId = setTimeout(() => {
          setSessionLoading(false);
          if (!hasValidSession) {
            setError('Invalid or expired password reset link. Please request a new reset email.');
          }
        }, 2000);
      } catch (err: any) {
        console.error('Recovery initialization error:', err);
        setError(err.message || 'Failed to initialize password recovery.');
        setSessionLoading(false);
      }
    };

    init();
    return () => {
      if (unsubscribe) unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasValidSession) {
      setError("No valid recovery session. Please request a new password reset link.");
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
      console.log('Updating user password...');
      
      // Verify session is still active before update
      const { data: currentSession } = await supabase.auth.getSession();
      if (!currentSession.session) {
        throw new Error('Recovery session expired. Please request a new password reset link.');
      }
      
      // Update password using established session
      const { error: updateError } = await supabase.auth.updateUser({
        password: sanitizeInput(form.newPassword)
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      console.log('Password updated successfully');
      
      // Sign out after successful password update to clear recovery session
      await supabase.auth.signOut();

      setSuccess(true);
      toast({ 
        title: "Password Reset Complete", 
        description: "Your password has been updated successfully. Please sign in with your new password." 
      });

      // Redirect to login after delay
      setTimeout(() => {
        navigate("/auth", { replace: true });
      }, 2000);
      
    } catch (err: any) {
      console.error("Password update failed:", err);
      setError(err.message || "Failed to update password. Please try again or request a new reset link.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while initializing session
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Initializing password recovery...</p>
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
              Password Reset Complete
            </CardTitle>
            <CardDescription>
              Your password has been successfully updated
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
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!hasValidSession ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                This password reset link is invalid or has expired.
              </p>
              <Button onClick={() => navigate("/auth", { replace: true })} variant="outline" className="w-full">
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
                <Button type="submit" disabled={loading || !hasValidSession} className="w-full">
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