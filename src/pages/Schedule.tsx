import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Settings, LogOut, Plus, Shield } from "lucide-react";
import ScheduleView from "@/components/schedule/ScheduleView";
import ScheduleEntryForm from "@/components/schedule/ScheduleEntryForm";
import TeamManagement from "@/components/schedule/TeamManagement";
import AdminSetup from "@/components/admin/AdminSetup";
import HolidayManager from "@/components/holidays/HolidayManager";
import CountrySelector from "@/components/profile/CountrySelector";
import PasswordSettings from "@/components/settings/PasswordSettings";
import BulkScheduleGenerator from "@/components/schedule/BulkScheduleGenerator";

const Schedule = () => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Employee Scheduler</h1>
            <p className="text-muted-foreground">Manage your team's schedule</p>
          </div>
          <Button onClick={handleSignOut} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="admin" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="admin" className="flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Admin Setup
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="holidays" className="flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Holidays
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="admin" className="space-y-6">
            <AdminSetup />
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Schedule Overview</h2>
                  <p className="text-muted-foreground">
                    View and manage team schedules
                  </p>
                </div>
                <ScheduleEntryForm>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Entry
                  </Button>
                </ScheduleEntryForm>
              </div>
              <BulkScheduleGenerator />
            </div>
            <ScheduleView />
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            <TeamManagement />
          </TabsContent>

          <TabsContent value="holidays" className="space-y-6">
            <HolidayManager />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="space-y-6">
              <CountrySelector />
              <PasswordSettings />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Schedule;