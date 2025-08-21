import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, sanitizeInput } from "@/lib/validation";

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const setupSession = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const access_token = hashParams.get("access_token") || searchParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token") || searchParams.get("refresh_token");
        const type = hashParams.get("type") || searchParams.get("type");

        if (!access_token || !refresh_token || type !== "recovery") {
          throw new Error("Invalid or expired password reset link.");
        }

        window.history.replaceState({}, document.title, window.location.pathname);

        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token
        });

        if (sessionError) throw new Error(`Session setup failed: ${sessionError.message}`);

        const { data: sessionData, error: verifyError } = await supabase.auth.getSession();
        if (verifyError || !sessionData.session) {
          throw new Error("Session verification failed.");
        }

        setSessionReady(true);
      } catch (err: any) {
        setError(err.message || "Failed to initialize password recovery.");
        setSessionReady(false);
      } finally {
        setInitializing(false);
      }
    };

    setupSession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sessionReady) {
      setError("Recovery session not ready. Please try again.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const { isValid, errors } = validatePassword(form.newPassword);
    if (!isValid) {
      setError(errors.join(", "));
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: sanitizeInput(form.newPassword)
      });

      if (updateError) throw new Error(`Password update failed: ${updateError.message}`);

      await supabase.auth.signOut();
      setSuccess(true);
      toast({
        title: "Password Reset Complete",
        description: "Your password has been updated successfully. Please sign in with your new password."
      });

      setTimeout(() => {
        navigate("/auth", { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              Password Updated Successfully
            </CardTitle>
            <CardDescription>You can now sign in with your new password</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">Redirecting to login page...</p>
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
          <CardDescription>Enter and confirm your new password</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Error:</strong> {error}
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
                <p className="text-xs text-muted-foreground">Must be at least 8 characters long</p>
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

export default ResetPassword;
