import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, sanitizeInput } from "@/lib/validation";

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [sessionRestored, setSessionRestored] = useState(false);

  // Restore session from access_token in URL
  useEffect(() => {
    const hash = window.location.hash;
    const accessToken = new URLSearchParams(hash.substring(1)).get("access_token");

    if (accessToken) {
      supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: "", // Not needed for recovery
        })
        .then(({ error }) => {
          if (error) {
            console.error("Session restore failed:", error.message);
            toast({
              title: "Error",
              description: "Failed to restore session. Please try the reset link again.",
              variant: "destructive",
            });
          } else {
            setSessionRestored(true);
          }
        });
    } else {
      toast({
        title: "Missing token",
        description: "No access token found in URL. Please use the link from your email.",
        variant: "destructive",
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    const { isValid, errors } = validatePassword(form.newPassword);
    if (!isValid) {
      toast({
       