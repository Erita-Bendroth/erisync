import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Mail, Eye, Plus, Trash2, Save } from "lucide-react";
import { DutyAssignmentGrid } from "./DutyAssignmentGrid";
import { DistributionListManager } from "./DistributionListManager";

interface WeeklyDutyCoverageManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WeeklyDutyCoverageManager({ open, onOpenChange }: WeeklyDutyCoverageManagerProps) {
  const { toast } = useToast();
  const [teams, setTeams] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [templateName, setTemplateName] = useState("");
  const [distributionList, setDistributionList] = useState<string[]>([]);
  const [includeWeekend, setIncludeWeekend] = useState(true);
  const [includeLateshift, setIncludeLateshift] = useState(false);
  const [includeEarlyshift, setIncludeEarlyshift] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [currentYear, setCurrentYear] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("template");

  useEffect(() => {
    if (open) {
      fetchTeams();
      fetchTemplates();
      const now = new Date();
      setCurrentYear(now.getFullYear());
      setCurrentWeek(getWeekNumber(now));
    }
  }, [open]);

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplate(selectedTemplate);
    }
  }, [selectedTemplate]);

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase.from('teams').select('*').order('name');
    if (!error && data) setTeams(data);
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase.from('weekly_duty_templates').select('*').order('template_name');
    if (!error && data) setTemplates(data);
  };

  const loadTemplate = async (templateId: string) => {
    const { data, error } = await supabase
      .from('weekly_duty_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!error && data) {
      setSelectedTeams(data.team_ids || []);
      setTemplateName(data.template_name);
      setDistributionList(data.distribution_list || []);
      setIncludeWeekend(data.include_weekend_duty);
      setIncludeLateshift(data.include_lateshift);
      setIncludeEarlyshift(data.include_earlyshift);
      toast({ title: "Success", description: "Template loaded" });
    }
  };

  const saveTemplate = async () => {
    if (selectedTeams.length === 0 || !templateName) {
      toast({ title: "Error", description: "Please select at least one team and enter a template name", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const templateData = {
      team_ids: selectedTeams,
      template_name: templateName,
      distribution_list: distributionList,
      include_weekend_duty: includeWeekend,
      include_lateshift: includeLateshift,
      include_earlyshift: includeEarlyshift,
      created_by: user?.id,
    };

    let error;
    if (selectedTemplate) {
      ({ error } = await supabase.from('weekly_duty_templates').update(templateData).eq('id', selectedTemplate));
    } else {
      const { data, error: insertError } = await supabase.from('weekly_duty_templates').insert(templateData).select().single();
      error = insertError;
      if (data) setSelectedTemplate(data.id);
    }

    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Template saved successfully" });
      fetchTemplates();
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplate) return;
    
    setLoading(true);
    const { error } = await supabase.from('weekly_duty_templates').delete().eq('id', selectedTemplate);
    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Template deleted" });
      setSelectedTemplate("");
      setTemplateName("");
      setDistributionList([]);
      setSelectedTeams([]);
      fetchTemplates();
    }
  };

  const handlePreview = async () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please save the template first", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('send-weekly-duty-coverage', {
      body: {
        template_id: selectedTemplate,
        week_number: currentWeek,
        year: currentYear,
        preview: true,
      },
    });

    setLoading(false);
    if (error || !data?.html) {
      toast({ title: "Error", description: error?.message || "Failed to generate preview", variant: "destructive" });
    } else {
      setPreviewHtml(data.html);
      setShowPreview(true);
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please save the template first", variant: "destructive" });
      return;
    }

    if (distributionList.length === 0) {
      toast({ title: "Error", description: "Please add recipients to the distribution list", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('send-weekly-duty-coverage', {
      body: {
        template_id: selectedTemplate,
        week_number: currentWeek,
        year: currentYear,
        preview: false,
      },
    });

    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const recipientCount = data.recipient_count || 0;
      toast({
        title: "Email sent successfully",
        description: `Sent to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`,
      });
    }
  };

  const changeWeek = (delta: number) => {
    let newWeek = currentWeek + delta;
    let newYear = currentYear;

    if (newWeek < 1) {
      newWeek = 52;
      newYear--;
    } else if (newWeek > 52) {
      newWeek = 1;
      newYear++;
    }

    setCurrentWeek(newWeek);
    setCurrentYear(newYear);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Weekly Duty Coverage Manager</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="template">Template Setup</TabsTrigger>
            <TabsTrigger value="assignments">Duty Assignments</TabsTrigger>
            <TabsTrigger value="send">Preview & Send</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Template Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Load Existing Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Template Name</Label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Troubleshooters Combined"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="teams">Teams *</Label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedTeams.map((teamId) => {
                        const team = teams.find((t) => t.id === teamId);
                        return (
                          <Badge key={teamId} variant="secondary" className="gap-1">
                            {team?.name}
                            <button
                              onClick={() => setSelectedTeams(selectedTeams.filter((id) => id !== teamId))}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                    <Select 
                      value="" 
                      onValueChange={(value) => {
                        if (value && !selectedTeams.includes(value)) {
                          setSelectedTeams([...selectedTeams, value]);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add team..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teams
                          .filter((team) => !selectedTeams.includes(team.id))
                          .map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Include Sections</Label>
                  <div className="flex items-center space-x-2">
                    <Switch checked={includeWeekend} onCheckedChange={setIncludeWeekend} />
                    <Label>Weekend/Holiday Duty</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={includeLateshift} onCheckedChange={setIncludeLateshift} />
                    <Label>Lateshift (14:00-20:00)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={includeEarlyshift} onCheckedChange={setIncludeEarlyshift} />
                    <Label>Earlyshift (06:00-14:00)</Label>
                  </div>
                </div>

                <DistributionListManager
                  distributionList={distributionList}
                  onUpdate={setDistributionList}
                />

                <div className="flex gap-2">
                  <Button onClick={saveTemplate} disabled={loading}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Template
                  </Button>
                  {selectedTemplate && (
                    <Button onClick={deleteTemplate} variant="destructive" disabled={loading}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments">
            {selectedTeams.length > 0 && selectedTemplate ? (
              <div className="space-y-6">
                {activeTab === "assignments" && selectedTeams.map((teamId) => {
                  const team = teams.find((t) => t.id === teamId);
                  return (
                    <Card key={teamId}>
                      <CardHeader>
                        <CardTitle>{team?.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <DutyAssignmentGrid
                          teamId={teamId}
                          weekNumber={currentWeek}
                          year={currentYear}
                          includeWeekend={includeWeekend}
                          includeLateshift={includeLateshift}
                          includeEarlyshift={includeEarlyshift}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Please select teams and save a template first
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="send" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Week Selection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-4">
                  <Button onClick={() => changeWeek(-1)} variant="outline">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="text-lg font-semibold">
                    Week {currentWeek}, {currentYear}
                  </div>
                  <Button onClick={() => changeWeek(1)} variant="outline">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2 justify-center">
              <Button onClick={handlePreview} disabled={loading || !selectedTemplate}>
                <Eye className="w-4 h-4 mr-2" />
                Preview Email
              </Button>
              <Button onClick={handleSend} disabled={loading || !selectedTemplate}>
                <Mail className="w-4 h-4 mr-2" />
                Send to Distribution List
              </Button>
            </div>
          </TabsContent>
        </Tabs>

      </DialogContent>
    </Dialog>

    {/* Separate preview dialog to avoid nesting issues */}
    {showPreview && (
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview - Weekly Duty Coverage</DialogTitle>
          </DialogHeader>
          <div 
            className="flex-1 overflow-y-auto bg-gray-100 p-4 rounded"
            dangerouslySetInnerHTML={{ __html: previewHtml }} 
          />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
