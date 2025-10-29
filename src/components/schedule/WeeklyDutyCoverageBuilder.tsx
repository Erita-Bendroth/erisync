import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailTableBuilder, EmailRegionTable, EmailTableRow } from "./EmailTableBuilder";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, Save, Eye, Download, Copy } from "lucide-react";
import { getWeek, getYear } from "date-fns";

interface WeeklyDutyCoverageBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EmailTemplate {
  id?: string;
  template_name: string;
  week_number: number;
  year: number;
  regions: EmailRegionTable[];
  notes: string[];
  distribution_list: string[];
}

export function WeeklyDutyCoverageBuilder({ open, onOpenChange }: WeeklyDutyCoverageBuilderProps) {
  const { toast } = useToast();
  const [template, setTemplate] = useState<EmailTemplate>({
    template_name: '',
    week_number: getWeek(new Date()),
    year: getYear(new Date()),
    regions: [],
    notes: [],
    distribution_list: [],
  });
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [distributionEmails, setDistributionEmails] = useState('');

  const createDefaultTable = (): EmailRegionTable => ({
    id: crypto.randomUUID(),
    title: `Region Table - KW ${template.week_number}`,
    rows: Array.from({ length: 7 }, () => ({
      id: crypto.randomUUID(),
      cells: Array.from({ length: 6 }, () => ({
        id: crypto.randomUUID(),
        content: '',
        backgroundColor: 'white' as const,
      })),
    })),
  });

  const addRegion = () => {
    setTemplate(prev => ({
      ...prev,
      regions: [...prev.regions, createDefaultTable()],
    }));
  };

  const updateRegion = (index: number, updatedTable: EmailRegionTable) => {
    const newRegions = [...template.regions];
    newRegions[index] = updatedTable;
    setTemplate(prev => ({ ...prev, regions: newRegions }));
  };

  const deleteRegion = (index: number) => {
    setTemplate(prev => ({
      ...prev,
      regions: prev.regions.filter((_, i) => i !== index),
    }));
  };

  const addNote = () => {
    if (newNote.trim()) {
      setTemplate(prev => ({
        ...prev,
        notes: [...prev.notes, newNote.trim()],
      }));
      setNewNote('');
    }
  };

  const deleteNote = (index: number) => {
    setTemplate(prev => ({
      ...prev,
      notes: prev.notes.filter((_, i) => i !== index),
    }));
  };

  const generateHtml = () => {
    const colorMap = {
      white: '#ffffff',
      green: '#90EE90',
      yellow: '#FFD700',
      red: '#FF6B6B',
      orange: '#FFA500',
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${template.template_name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; }
    h1 { color: #333; margin-bottom: 30px; }
    h2 { color: #555; margin-top: 30px; margin-bottom: 15px; font-size: 18px; }
    .region-table { margin-bottom: 30px; border-collapse: collapse; width: 100%; }
    .region-table td { 
      border: 1px solid #333; 
      padding: 8px; 
      text-align: center;
      font-size: 11px;
      min-height: 40px;
      vertical-align: top;
    }
    .notes { margin-top: 30px; }
    .notes h3 { color: #555; font-size: 16px; }
    .notes ul { list-style: disc; margin-left: 20px; }
    .notes li { margin-bottom: 5px; }
    @media (max-width: 768px) {
      .region-table { font-size: 9px; }
      .region-table td { padding: 4px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${template.template_name} - KW ${template.week_number}</h1>
    
    ${template.regions.map(region => `
      <h2>${region.title}</h2>
      <table class="region-table">
        ${region.rows.map(row => `
          <tr>
            ${row.cells.map(cell => `
              <td style="background-color: ${colorMap[cell.backgroundColor]};">
                ${cell.content.replace(/\n/g, '<br>')}
              </td>
            `).join('')}
          </tr>
        `).join('')}
      </table>
    `).join('')}
    
    ${template.notes.length > 0 ? `
      <div class="notes">
        <h3>Notes</h3>
        <ul>
          ${template.notes.map(note => `<li>${note}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  </div>
</body>
</html>
    `.trim();
  };

  const handlePreview = () => {
    const html = generateHtml();
    setPreviewHtml(html);
    setShowPreview(true);
  };

  const handleSave = async () => {
    if (!template.template_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a template name",
        variant: "destructive",
      });
      return;
    }

    if (template.regions.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one region table",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const emails = distributionEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e);

      const templateData = {
        template_name: template.template_name,
        week_number: template.week_number,
        year: template.year,
        template_data: {
          regions: template.regions,
          notes: template.notes,
        } as any,
        distribution_list: emails,
        created_by: user.id,
      };

      if (template.id) {
        const { error } = await supabase
          .from('custom_duty_email_templates')
          .update(templateData)
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('custom_duty_email_templates')
          .insert([templateData])
          .select()
          .single();
        if (error) throw error;
        setTemplate(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: "Template Saved",
        description: "Your email template has been saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!template.id) {
      toast({
        title: "Save First",
        description: "Please save the template before sending",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-custom-duty-email', {
        body: { template_id: template.id },
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: "Duty coverage email sent successfully",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Send Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadHtml = () => {
    const html = generateHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.template_name}-KW${template.week_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyHtml = () => {
    const html = generateHtml();
    navigator.clipboard.writeText(html);
    toast({
      title: "Copied",
      description: "HTML copied to clipboard",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom Weekly Duty Coverage Email Builder</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="setup">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="preview">Preview & Send</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={template.template_name}
                  onChange={(e) => setTemplate(prev => ({ ...prev, template_name: e.target.value }))}
                  placeholder="e.g., Weekend oncall / Lateshift TS/L2 Central"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="week-number">Week Number</Label>
                  <Input
                    id="week-number"
                    type="number"
                    value={template.week_number}
                    onChange={(e) => setTemplate(prev => ({ ...prev, week_number: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={template.year}
                    onChange={(e) => setTemplate(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="distribution-list">Distribution List (comma-separated emails)</Label>
                <Textarea
                  id="distribution-list"
                  value={distributionEmails}
                  onChange={(e) => setDistributionEmails(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  rows={3}
                />
              </div>

              <div>
                <Label>Notes</Label>
                <div className="space-y-2">
                  {template.notes.map((note, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="flex-1 text-sm">• {note}</span>
                      <Button variant="ghost" size="sm" onClick={() => deleteNote(index)}>
                        <Plus className="h-4 w-4 rotate-45" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note"
                      onKeyPress={(e) => e.key === 'Enter' && addNote()}
                    />
                    <Button onClick={addNote} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            {template.regions.map((region, index) => (
              <EmailTableBuilder
                key={region.id}
                table={region}
                onChange={(updated) => updateRegion(index, updated)}
                onDelete={() => deleteRegion(index)}
              />
            ))}

            <Button onClick={addRegion} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Region Table
            </Button>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handlePreview} variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={handleDownloadHtml} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download HTML
              </Button>
              <Button onClick={handleCopyHtml} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copy HTML
              </Button>
            </div>

            {showPreview && (
              <div className="border rounded-lg p-4 bg-card max-h-96 overflow-auto">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
          <Button onClick={handleSend} disabled={isSending || !template.id}>
            <Send className="h-4 w-4 mr-2" />
            {isSending ? 'Sending...' : 'Send Email'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
