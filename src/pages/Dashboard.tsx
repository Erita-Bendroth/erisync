import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ScheduleEntryForm from "@/components/schedule/ScheduleEntryForm";
import UserSchedulesToday from "@/components/dashboard/UserSchedulesToday"; // 👈 New component

interface UserRole {
  role: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
}

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [teamMemberSchedules, setTeamMemberSchedules] = useState<any[]>([]); // 👈 New state

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchTeamMemberSchedules(); // 👈 Fetch all users' schedules
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", user!.id)
        .single();

      if (profileData) setProfile(profileData);

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (rolesData) setUserRoles(rolesData);

      const { data: teamsData } = await supabase
        .from("team_members")
        .select(`
          teams (
            id,
            name,
            description
          )
        `)
        .eq("user_id", user!.id);

      if (teamsData) {
        const teams = teamsData.map((item: any) => item.teams).filter(Boolean);
        setUserTeams(teams);
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: scheduleData } = await supabase
        .from("schedule_entries")
        .select("*")
        .eq("user_id", user!.id)
        .eq("date", today);

      if (scheduleData) setTodaySchedule(scheduleData);
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMemberSchedules = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("schedule_entries")
      .select(`
        activity,
        start_time,
        end_time,
        date,
        user_id,
        profiles (
          first_name,
          last_name
        )
      `)
      .eq("date", today);

    if (error) {
      console.error("Error fetching team member schedules:", error);
      toast({
       