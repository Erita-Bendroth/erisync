import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Settings, LogOut, Plus, Shield, Mail } from "lucide-react";
import ScheduleView from "@/components/schedule/ScheduleView";
import ScheduleEntryForm from "@/components/schedule/ScheduleEntryForm";
import TeamManagement from "@/components/schedule/TeamManagement";
import AdminSetup from "@/components/admin/AdminSetup";
import HolidayManager from "@/components/holidays/HolidayManager";
import CountrySelector from "@/components/profile/CountrySelector";
import PasswordSettings from "@/components/settings/PasswordSettings";
import BulkScheduleGenerator from "@/components/schedule/BulkScheduleGenerator";
import UserProfileOverview from "@/components/profile/UserProfileOverview";
import OutlookIntegration from "@/components/integrations/OutlookIntegration";
import { supabase } from "@/integrations/supabase/client";

const Schedule = () => {
  const { signOut, user } = useAuth();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'admin';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // Two-week notification state
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [recipients, setRecipients] = useState<{ id: string; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      fetchUserRoles();
    }
  }, [user]);

  const fetchUserRoles = async () => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      
      setUserRoles(data?.map(r => r.role) || []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const isPlanner = () => userRoles.includes('planner');
  const isManager = () => userRoles.includes('manager');

  const handleSignOut = async () => {
    await signOut();
  };

  const getRange = () => {
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(end.getDate() + 13);
    const toStr = (d: Date) => d.toISOString().split('T')[0];
    return { start_date: toStr(start), end_date: toStr(end) };
  };

  const openNotify = async () => {
    if (!user) return;
    setNotifyOpen(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .order('first_name');
      if (error) throw error;
      setRecipients((data || []).map(p => ({ id: p.user_id, name: `${p.first_name} ${p.last_name}` })));
    } catch (e) {
      console.error('Failed to load users for notification', e);
    }
  };

  const previewTwoWeekEmail = async () => {
    if (!selectedUserId) return;
    setLoadingPreview(true);
    try {
      const { start_date, end_date } = getRange();
      const { data, error } = await supabase.functions.invoke('send-future-schedule', {
        body: { user_id: selectedUserId, start_date, end_date, preview: true }
      });
      if (error) throw error;
      setPreviewHtml(data?.html || '<p>No preview.</p>');
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const sendTwoWeekEmail = async () => {
    if (!selectedUserId) return;
    setSending(true);
    try {
      const { start_date, end_date } = getRange();
      const { error } = await supabase.functions.invoke('send-future-schedule', {
        body: { user_id: selectedUserId, start_date, end_date, preview: false }
      });
      if (error) throw error;
      setNotifyOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Employee Scheduler</h1>
            <p className="text-muted-foreground">Manage your team's schedule</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              onClick={() => window.location.href = '/dashboard'} 
              variant="outline" 
              size="sm"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                <div className="flex items-center gap-2">
                  <ScheduleEntryForm>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Entry
                    </Button>
                  </ScheduleEntryForm>
                  {(isPlanner() || isManager()) && (
                    <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" onClick={openNotify}>
                          <Mail className="w-4 h-4 mr-2" />
                          2-week Summary
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Send 2-week schedule summary</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Recipient</label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a user" />
                              </SelectTrigger>
                              <SelectContent>
                                {recipients.map(r => (
                                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="border rounded p-3 max-h-72 overflow-auto bg-card">
                            {previewHtml ? (
                              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                            ) : (
                              <p className="text-sm text-muted-foreground">Generate a preview to see the email content.</p>
                            )}
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={previewTwoWeekEmail} disabled={!selectedUserId || loadingPreview}>
                            {loadingPreview ? 'Preparing…' : 'Preview'}
                          </Button>
                          <Button onClick={sendTwoWeekEmail} disabled={!selectedUserId || sending}>
                            {sending ? 'Sending…' : 'Send Email'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
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
              <OutlookIntegration />
              
              {/* Profile Overview - Only for planners and managers */}
              {(isPlanner() || isManager()) && user && (
                <UserProfileOverview 
                  userId={user.id} 
                  canView={isPlanner() || isManager()} 
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Schedule;