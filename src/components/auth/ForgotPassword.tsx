// ResetPassword.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  Button, Input, Label
} from "@/components/ui";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, sanitizeInput } from "@/lib/validation";

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const token = searchParams.get("access_token");

  useEffect(() => {
    // Check if token exists
    if (token) {
      setTokenValid(true);
    } else {
      toast({ title: "Invalid link", description: "Missing recovery token", variant: "destructive" });
      navigate("/login");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    const { isValid, errors } = validatePassword(form.newPassword);
    if (!isValid) {
      toast({ title: "Invalid password", description: errors.join(", "), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const sanitized = sanitizeInput(form.newPassword);
      const { error } = await supabase.auth.verifyOtp({
        type: "recovery",
        token: token!,
        password: sanitized,
      });

      if (error) throw error;

      toast({ title: "Password updated", description: "You can now log in with your new password." });
      navigate("/login");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Set New Password</CardTitle>
        <CardDescription>Enter and confirm your new password</CardDescription>
      </CardHeader>
      <CardContent>
        {tokenValid ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        ) : (
          <p className="text-center text-red-500">Invalid or expired reset link.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ResetPassword;
