import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Settings, LogOut, Plus, Shield, Mail, Download } from "lucide-react";
import ScheduleView from "@/components/schedule/ScheduleView";
import ScheduleEntryForm from "@/components/schedule/ScheduleEntryForm";
import TeamManagement from "@/components/schedule/TeamManagement";
import AdminSetup from "@/components/admin/AdminSetup";
import CountrySelector from "@/components/profile/CountrySelector";
import PasswordSettings from "@/components/settings/PasswordSettings";
import NotificationSettings from "@/components/settings/NotificationSettings";
import BulkScheduleGenerator from "@/components/schedule/BulkScheduleGenerator";
import ScheduleExport from "@/components/schedule/ScheduleExport";
import UserProfileOverview from "@/components/profile/UserProfileOverview";
import OutlookIntegration from "@/components/integrations/OutlookIntegration";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { escapeHtml } from "@/lib/validation";

const Schedule = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'admin';
  const teamFromUrl = searchParams.get('team') || '';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // Two-week notification state
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [recipients, setRecipients] = useState<{ id: string; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [sendMode, setSendMode] = useState<"individual" | "team">("individual");
  const [availableTeams, setAvailableTeams] = useState<{ id: string; name: string }[]>([]);
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
      // Fetch individual users
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_all_basic_profiles');
      if (usersError) throw usersError;
      setRecipients((usersData || []).map(p => ({ id: p.user_id, name: `${p.first_name} ${p.last_name}` })));

      // Fetch teams data if user is planner or manager - teams query is still allowed
      if (isPlanner() || isManager()) {
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id, name')
          .order('name');
        if (teamsError) throw teamsError;
        setAvailableTeams((teamsData || []).map(t => ({ id: t.id, name: t.name })));
      }
    } catch (e) {
      console.error('Failed to load data for notification', e);
    }
  };

  const previewTwoWeekEmail = async () => {
    if (sendMode === "individual" && !selectedUserId) return;
    if (sendMode === "team" && !selectedTeamId) return;
    
    setLoadingPreview(true);
    try {
      const { start_date, end_date } = getRange();
      
      if (sendMode === "individual") {
        const { data, error } = await supabase.functions.invoke('send-future-schedule', {
          body: { user_id: selectedUserId, start_date, end_date, preview: true }
        });
        if (error) throw error;
        setPreviewHtml(data?.html || '<p>No preview.</p>');
      } else {
        // Team preview - get team members first, then their profiles separately
        const { data: teamMembersData, error: membersError } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', selectedTeamId);
        
        if (membersError) {
          console.error('Error fetching team members:', membersError);
          throw membersError;
        }
        
        if (!teamMembersData || teamMembersData.length === 0) {
          setPreviewHtml(`
            <div style="font-family:Inter,system-ui,sans-serif">
              <h2>Team Email Preview</h2>
              <p>No members found in the selected team.</p>
            </div>
          `);
          return;
        }
        
        // Get profiles for these users using secure function
        const userIds = teamMembersData.map(tm => tm.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .rpc('get_multiple_basic_profile_info', { _user_ids: userIds });
        
        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          throw profilesError;
        }
        
        const members = profilesData || [];
        const teamName = availableTeams.find(t => t.id === selectedTeamId)?.name || 'Selected Team';
        
        setPreviewHtml(`
          <div style="font-family:Inter,system-ui,sans-serif">
            <h2>Team Email Preview: ${escapeHtml(teamName)}</h2>
            <p>2-week schedule summaries will be sent to <strong>${members.length}</strong> team members:</p>
            <ul style="margin:16px 0;padding-left:24px">
              ${members.map((m: any) => `<li>${escapeHtml(m.first_name)} ${escapeHtml(m.last_name)} ${m.email ? `(${escapeHtml(m.email)})` : '(Email restricted)'}</li>`).join('')}
            </ul>
            <p><em>Each team member will receive their individual 2-week schedule summary.</em></p>
          </div>
        `);
      }
    } catch (e: any) {
      console.error(e);
      setPreviewHtml('<p style="color:red">Error generating preview</p>');
      toast({
        title: "Preview Error",
        description: e.message || "Failed to generate preview",
        variant: "destructive",
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const sendTwoWeekEmail = async () => {
    if (sendMode === "individual" && !selectedUserId) return;
    if (sendMode === "team" && !selectedTeamId) return;
    
    setSending(true);
    try {
      const { start_date, end_date } = getRange();
      
      if (sendMode === "individual") {
        const { data, error } = await supabase.functions.invoke('send-future-schedule', {
          body: { user_id: selectedUserId, start_date, end_date, preview: false }
        });
        if (error) throw error;
        
        toast({
          title: "Email Sent!",
          description: `2-week schedule summary sent successfully.`,
        });
      } else {
        const { data, error } = await supabase.functions.invoke('send-team-schedule-summary', {
          body: { team_id: selectedTeamId, start_date, end_date }
        });
        if (error) throw error;
        
        const teamName = availableTeams.find(t => t.id === selectedTeamId)?.name || 'Selected Team';
        toast({
          title: "Team Emails Sent!",
          description: `2-week schedule summaries sent to all members of ${teamName}.`,
        });
      }
      
      setNotifyOpen(false);
      // Reset form state
      setSelectedUserId("");
      setSelectedTeamId("");
      setPreviewHtml("");
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Email Error",
        description: e.message || "Failed to send email. Please check your email configuration.",
        variant: "destructive",
      });
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
          <TabsList className="grid w-full grid-cols-4">
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
                  <Button variant="outline" onClick={() => setActiveTab('settings')}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Schedule
                  </Button>
                  {(isPlanner() || isManager()) && (
                    <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" onClick={openNotify}>
                          <Mail className="w-4 h-4 mr-2" />
                          2-week Summary
                        </Button>
                      </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                          <DialogHeader className="flex-shrink-0">
                            <DialogTitle className="flex items-center gap-2">
                              <Mail className="w-5 h-5" />
                              Send 2-Week Schedule Summary
                            </DialogTitle>
                            <DialogDescription>
                              Send personalized 2-week schedule summaries to individual users or entire teams.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                            <div className="space-y-3">
                              <label className="text-sm font-medium">Send Mode</label>
                              <Select value={sendMode} onValueChange={(value: "individual" | "team") => setSendMode(value)}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="individual">📧 Individual User</SelectItem>
                                   {(isPlanner() || isManager()) && (
                                     <SelectItem value="team">👥 Entire Team</SelectItem>
                                   )}
                                </SelectContent>
                              </Select>
                            </div>

                            {sendMode === "individual" ? (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Select Recipient</label>
                                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Choose a user to send the summary to..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {recipients.map(r => (
                                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Select Team</label>
                                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Choose a team to send summaries to all members..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableTeams.map(t => (
                                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">
                                  {sendMode === "team" ? "Team Preview" : "Email Preview"}
                                </h4>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={previewTwoWeekEmail} 
                                  disabled={
                                    loadingPreview || 
                                    (sendMode === "individual" && !selectedUserId) ||
                                    (sendMode === "team" && !selectedTeamId)
                                  }
                                >
                                  {loadingPreview ? 'Generating...' : 'Generate Preview'}
                                </Button>
                              </div>
                              
                              <div className="border rounded-lg bg-background h-64 overflow-auto">
                                {previewHtml ? (
                                  <div className="p-4 prose prose-sm max-w-none">
                                    <div className="whitespace-pre-wrap">{previewHtml}</div>
                                  </div>
                                ) : (
                                  <div className="p-6 text-center text-muted-foreground h-full flex flex-col justify-center">
                                    <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                    <p className="font-medium text-sm">No preview available</p>
                                    <p className="text-xs mt-1">
                                      {sendMode === "individual" 
                                        ? "Select a recipient and click 'Generate Preview' to see the email content."
                                        : "Select a team and click 'Generate Preview' to see who will receive emails."
                                      }
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        
                        <DialogFooter className="gap-2">
                          <Button variant="outline" onClick={() => setNotifyOpen(false)}>
                            Cancel
                          </Button>
                           <Button 
                             onClick={sendTwoWeekEmail} 
                             disabled={
                               loadingPreview || 
                               sending || 
                               !previewHtml ||
                               (sendMode === "individual" && !selectedUserId) ||
                               (sendMode === "team" && !selectedTeamId)
                             }
                             className="min-w-24"
                           >
                             {sending ? 'Sending...' : (sendMode === "team" ? 'Send to Team' : 'Send Email')}
                           </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
              <BulkScheduleGenerator />
            </div>
            <ScheduleView initialTeamId={teamFromUrl} />
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            <TeamManagement />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="space-y-6">
              <CountrySelector />
              <NotificationSettings />
              <PasswordSettings />
              <ScheduleExport scheduleData={[]} currentWeek={new Date()} />
              <OutlookIntegration />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Schedule;