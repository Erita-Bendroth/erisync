import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, sanitizeInput } from "@/lib/validation";

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [sessionReady, setSessionReady] = useState(false);

  // Parse tokens from either hash or query params
  const parseTokens = () => {
    const fromQuery = {
      access_token: searchParams.get('access_token') || undefined,
      refresh_token: searchParams.get('refresh_token') || undefined,
      type: searchParams.get('type') || undefined,
      code: searchParams.get('code') || undefined,
    };

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const fromHash = {
      access_token: hashParams.get('access_token') || undefined,
      refresh_token: hashParams.get('refresh_token') || undefined,
      type: hashParams.get('type') || undefined,
      code: hashParams.get('code') || undefined,
    };

    // Prefer hash (Supabase usually uses hash), fallback to query
    return {
      access_token: fromHash.access_token || fromQuery.access_token,
      refresh_token: fromHash.refresh_token || fromQuery.refresh_token,
      type: fromHash.type || fromQuery.type,
      code: fromHash.code || fromQuery.code,
    } as { access_token?: string; refresh_token?: string; type?: string; code?: string };
  };

  useEffect(() => {
    const init = async () => {
      setError(null);
      const tokens = parseTokens();

      try {
        // If we have an OAuth code (rare for recovery), exchange it
        if (tokens.code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(tokens.code);
          if (error) throw error;
          setSessionReady(!!data.session);
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // For recovery links we expect access and refresh tokens
        if (tokens.access_token && tokens.refresh_token && (!tokens.type || tokens.type === 'recovery')) {
          const { data, error } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          });
          if (error) throw error;
          setSessionReady(!!data.session);
          // Clean URL hash to avoid leaking tokens
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          return;
        }

        // If no tokens found, see if a session already exists
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setSessionReady(true);
          return;
        }

        setError("Invalid or expired reset link. Please request a new password reset email.");
      } catch (err: any) {
        console.error('Error initializing reset session:', err);
        setError(err.message || 'Failed to initialize password reset session.');
      }
    };

    // Defer to avoid potential auth deadlocks
    setTimeout(init, 0);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sessionReady) {
      setError("Invalid reset session. Please request a new password reset link.");
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
      // Use updateUser directly for password recovery
      const { error: updateError } = await supabase.auth.updateUser({
        password: sanitizeInput(form.newPassword)
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        throw updateError;
      }

      toast({ 
        title: "Password Updated", 
        description: "Your password has been successfully updated. You can now sign in with your new password." 
      });

      // Redirect to auth page after successful password reset
      navigate("/auth");
      
    } catch (err: any) {
      console.error("Password reset error:", err);
      setError(err.message || "Failed to update password. Please try again or request a new reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
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

          {!sessionReady ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Invalid or missing reset session.
              </p>
              <Button onClick={() => navigate("/auth")}>
                Back to Sign In
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
                />
              </div>
              
              <div className="space-y-2">
                <Button type="submit" disabled={loading || !sessionReady} className="w-full">
                  {loading ? "Updating Password..." : "Update Password"}
                </Button>
                
                <Button 
                  type="button"
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate("/auth")}
                  disabled={loading}
                >
                  Back to Sign In
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