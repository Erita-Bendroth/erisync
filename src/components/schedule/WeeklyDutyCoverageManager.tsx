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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Mail, Eye, Plus, Trash2, Save, RefreshCw, Info, ImageIcon } from "lucide-react";
import { DutyAssignmentGrid } from "./DutyAssignmentGrid";
import { DistributionListManager } from "./DistributionListManager";
import { EmailTableBuilder } from "./EmailTableBuilder";

interface EmailTableCell {
  id: string;
  content: string;
  backgroundColor: 'white' | 'green' | 'yellow' | 'red' | 'orange';
}

interface EmailTableRow {
  id: string;
  cells: EmailTableCell[];
}

interface EmailRegionTable {
  id: string;
  title: string;
  rows: EmailTableRow[];
}

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
  const [customRegions, setCustomRegions] = useState<EmailRegionTable[]>([]);
  const [customNotes, setCustomNotes] = useState<string[]>([]);
  const [useCustomLayout, setUseCustomLayout] = useState(false);
  const [customTemplateId, setCustomTemplateId] = useState<string | null>(null);
  const [customScreenshots, setCustomScreenshots] = useState<Array<{
    id: string;
    name: string;
    url: string;
    caption: string;
  }>>([]);

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
      toast({
        title: "Success",
        description: `Sent to ${data.sent || 0} recipients${data.failed ? ` (${data.failed} failed)` : ''}`,
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

  const loadAutoGeneratedData = async () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please select a template first", variant: "destructive" });
      return;
    }

    setLoading(true);
    
    try {
      console.log('Calling edge function with:', {
        template_id: selectedTemplate,
        week_number: currentWeek,
        year: currentYear,
        preview: true,
        return_structured_data: true,
      });

      const { data, error } = await supabase.functions.invoke('send-weekly-duty-coverage', {
        body: {
          template_id: selectedTemplate,
          week_number: currentWeek,
          year: currentYear,
          preview: true,
          return_structured_data: true,
        },
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Unknown error');
      }

      if (!data) {
        throw new Error('No data returned from edge function');
      }

      if (!data.assignments || !Array.isArray(data.assignments)) {
        console.error('Invalid data structure:', data);
        throw new Error('Invalid response structure - expected assignments array');
      }

      if (data.assignments.length === 0) {
        toast({ 
          title: "No Assignments", 
          description: "No duty assignments found for this week. Please add some assignments first.",
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      console.log(`Processing ${data.assignments.length} assignments`);
      const regions = convertAssignmentsToTables(data.assignments);
      
      if (regions.length === 0) {
        toast({ 
          title: "No Data", 
          description: "Could not generate tables from assignments",
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      setCustomRegions(regions);
      setUseCustomLayout(true);
      toast({ title: "Success", description: `Loaded ${data.assignments.length} assignments into ${regions.length} tables` });
    } catch (err: any) {
      console.error('Load assignments error:', err);
      toast({ 
        title: "Error Loading Assignments", 
        description: err.message || "Failed to load assignments", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const convertAssignmentsToTables = (assignments: any[]): EmailRegionTable[] => {
    if (!assignments || assignments.length === 0) {
      console.warn('No assignments to convert');
      return [];
    }

    console.log('Converting assignments:', assignments);
    const regions: EmailRegionTable[] = [];
    
    const weekendDuty = assignments.filter((a: any) => a.duty_type === 'weekend');
    const lateshiftDuty = assignments.filter((a: any) => a.duty_type === 'lateshift');
    const earlyshiftDuty = assignments.filter((a: any) => a.duty_type === 'earlyshift');
    
    console.log('Grouped assignments:', { 
      weekend: weekendDuty.length, 
      lateshift: lateshiftDuty.length, 
      earlyshift: earlyshiftDuty.length 
    });
    
    if (weekendDuty.length > 0) {
      regions.push(createDutyTable('Weekend Duty', weekendDuty));
    }
    if (lateshiftDuty.length > 0) {
      regions.push(createDutyTable('Lateshift', lateshiftDuty));
    }
    if (earlyshiftDuty.length > 0) {
      regions.push(createDutyTable('Earlyshift', earlyshiftDuty));
    }
    
    console.log(`Created ${regions.length} regions`);
    return regions;
  };

  const createDutyTable = (title: string, assignments: any[]): EmailRegionTable => {
    const byDate: Record<string, any[]> = {};
    assignments.forEach((a: any) => {
      if (!byDate[a.date]) byDate[a.date] = [];
      byDate[a.date].push(a);
    });
    
    const rows: EmailTableRow[] = [];
    const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    
    Object.keys(byDate).sort().forEach(date => {
      const dateObj = new Date(date + 'T00:00:00Z');
      const dayName = dayNames[dateObj.getUTCDay()];
      
      const cells: EmailTableCell[] = [
        { 
          id: crypto.randomUUID(), 
          content: `${dayName}\n${date}`, 
          backgroundColor: 'white' 
        },
      ];
      
      byDate[date].forEach((assignment: any) => {
        const userName = assignment.user?.initials || assignment.user?.first_name || 'TBD';
        const region = assignment.responsibility_region || '';
        const cellContent = region ? `${userName}\n${region}` : userName;
        
        cells.push({
          id: crypto.randomUUID(),
          content: cellContent,
          backgroundColor: 'white'
        });
      });
      
      rows.push({ id: crypto.randomUUID(), cells });
    });
    
    return {
      id: crypto.randomUUID(),
      title: `${title} - KW ${currentWeek}`,
      rows
    };
  };

  const getWeekDates = (weekNumber: number, year: number): Date[] => {
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay() || 7;
    const firstMonday = new Date(year, 0, 1 + ((8 - jan1Day) % 7));
    const daysOffset = (weekNumber - 1) * 7;
    const weekStart = new Date(firstMonday.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    
    const dates: Date[] = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const addCustomRegion = () => {
    const weekDates = getWeekDates(currentWeek, currentYear);
    const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
    
    const rows = weekDates.map((date, index) => {
      const dateStr = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
      const combinedDateWeekday = `${dateStr} ${weekdays[index]}`;
      
      return {
        id: crypto.randomUUID(),
        cells: [
          { 
            id: crypto.randomUUID(), 
            content: combinedDateWeekday, 
            backgroundColor: 'white' as const
          },
          { 
            id: crypto.randomUUID(), 
            content: '', 
            backgroundColor: 'white' as const
          },
        ]
      };
    });
    
    const newRegion: EmailRegionTable = {
      id: crypto.randomUUID(),
      title: 'New Custom Table',
      rows
    };
    setCustomRegions([...customRegions, newRegion]);
  };

  const updateCustomRegion = (index: number, updated: EmailRegionTable) => {
    const newRegions = [...customRegions];
    newRegions[index] = updated;
    setCustomRegions(newRegions);
  };

  const deleteCustomRegion = (index: number) => {
    setCustomRegions(customRegions.filter((_, i) => i !== index));
  };

  const addNote = () => {
    setCustomNotes([...customNotes, '']);
  };

  const updateNote = (index: number, value: string) => {
    const newNotes = [...customNotes];
    newNotes[index] = value;
    setCustomNotes(newNotes);
  };

  const deleteNote = (index: number) => {
    setCustomNotes(customNotes.filter((_, i) => i !== index));
  };

  const handleScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({ title: "Error", description: "Please upload an image file", variant: "destructive" });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be smaller than 5MB", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('email-screenshots')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('email-screenshots')
        .getPublicUrl(fileName);
      
      setCustomScreenshots([
        ...customScreenshots,
        {
          id: crypto.randomUUID(),
          name: file.name,
          url: publicUrl,
          caption: ''
        }
      ]);
      
      toast({ title: "Success", description: "Screenshot uploaded successfully" });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: "Error", description: error.message || "Failed to upload screenshot", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateScreenshotCaption = (id: string, caption: string) => {
    setCustomScreenshots(
      customScreenshots.map(s => s.id === id ? { ...s, caption } : s)
    );
  };

  const deleteScreenshot = (id: string) => {
    setCustomScreenshots(customScreenshots.filter(s => s.id !== id));
  };

  const saveCustomLayout = async () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please save the template first", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const templateData = {
      source_template_id: selectedTemplate,
      week_number: currentWeek,
      year: currentYear,
      template_name: `${templateName} - Custom Layout`,
      template_data: {
        regions: customRegions,
        notes: customNotes,
        screenshots: customScreenshots,
      } as any,
      distribution_list: distributionList,
      mode: 'hybrid',
      created_by: user?.id,
    };

    const { data, error } = customTemplateId
      ? await supabase.from('custom_duty_email_templates').update(templateData).eq('id', customTemplateId).select().single()
      : await supabase.from('custom_duty_email_templates').insert([templateData]).select().single();

    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (data) setCustomTemplateId(data.id);
      toast({ title: "Success", description: "Custom layout saved successfully" });
    }
  };

  const previewCustomLayout = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('send-custom-duty-email', {
      body: {
        template_name: templateName,
        week_number: currentWeek,
        template_data: {
          regions: customRegions,
          notes: customNotes,
        },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Weekly Duty Coverage Manager</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="template">
          <TabsList>
            <TabsTrigger value="template">Template Setup</TabsTrigger>
            <TabsTrigger value="assignments">Duty Assignments</TabsTrigger>
            <TabsTrigger value="send">Preview & Send</TabsTrigger>
            <TabsTrigger value="customize">Customize Layout</TabsTrigger>
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
                {selectedTeams.map((teamId) => {
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

          <TabsContent value="customize" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                The standard duty assignments (Weekend, Late Shift, Early Shift) will automatically appear at the top of the email.
                Use this tab to add additional custom content that will appear BELOW those tables.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={addCustomRegion} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Table
              </Button>
              <Button 
                variant="outline" 
                onClick={() => document.getElementById('screenshot-upload')?.click()}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Add Screenshot
              </Button>
              <input
                id="screenshot-upload"
                type="file"
                accept="image/*"
                onChange={handleScreenshotUpload}
                className="hidden"
              />
            </div>

            {customRegions.length > 0 && (
              <div className="space-y-6">
                {customRegions.map((region, index) => (
                  <div key={region.id}>
                    <EmailTableBuilder
                      table={region}
                      onChange={(updated) => updateCustomRegion(index, updated)}
                      onDelete={() => deleteCustomRegion(index)}
                    />
                  </div>
                ))}
              </div>
            )}

            {customScreenshots.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Screenshots</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customScreenshots.map((screenshot) => (
                    <div key={screenshot.id} className="border rounded-lg p-4 space-y-2">
                      <img 
                        src={screenshot.url} 
                        alt={screenshot.name}
                        className="max-w-full h-auto rounded"
                      />
                      <Input
                        value={screenshot.caption}
                        onChange={(e) => updateScreenshotCaption(screenshot.id, e.target.value)}
                        placeholder="Add caption..."
                      />
                      <Button 
                        onClick={() => deleteScreenshot(screenshot.id)} 
                        variant="destructive" 
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {customRegions.length > 0 && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {customNotes.map((note, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={note}
                          onChange={(e) => updateNote(index, e.target.value)}
                          placeholder="Add a note..."
                        />
                        <Button onClick={() => deleteNote(index)} variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button onClick={addNote} variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Note
                    </Button>
                  </CardContent>
                </Card>

                <div className="flex gap-2 justify-center">
                  <Button onClick={saveCustomLayout} disabled={loading}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Custom Layout
                  </Button>
                  <Button onClick={previewCustomLayout} disabled={loading}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Custom Email
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {showPreview && (
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Email Preview</DialogTitle>
              </DialogHeader>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
