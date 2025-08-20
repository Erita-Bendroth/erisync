// ForgotPassword.tsx
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateEmail, sanitizeInput } from "@/lib/validation";

interface ForgotPasswordProps {
  onBack: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(sanitizeInput(email), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSent(true);
      toast({ title: "Reset email sent", description: "Check your inbox for instructions." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send reset email", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Forgot Password</CardTitle>
        <CardDescription>Enter your email to receive a reset link</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-center">We've sent a reset link to {email}. Check your inbox.</p>
        ) : (
          <form onSubmit={handleSendResetEmail} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending..." : "Send Reset Email"}
            </Button>
            <Button type="button" onClick={onBack} variant="ghost" className="w-full">
              Back to Sign In
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default ForgotPassword;
