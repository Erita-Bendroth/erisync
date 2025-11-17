import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { generatePatternPreview } from '@/lib/rotationPatternUtils';
import { useShiftTypes } from '@/hooks/useShiftTypes';
import { Loader2 } from 'lucide-react';

interface ShiftRotationTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Array<{ id: string; name: string }>;
  template?: any;
  onSave: (template: any) => Promise<void>;
}

export const ShiftRotationTemplateDialog = ({
  open,
  onOpenChange,
  teams,
  template,
  onSave,
}: ShiftRotationTemplateDialogProps) => {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [patternType, setPatternType] = useState<'fixed_days' | 'repeating_sequence' | 'weekly_pattern' | 'custom'>('fixed_days');
  const [isPublic, setIsPublic] = useState(false);
  
  // Fixed Days config
  const [workDays, setWorkDays] = useState(4);
  const [offDays, setOffDays] = useState(4);
  const [fixedShiftType, setFixedShiftType] = useState('normal');
  
  // Repeating Sequence config
  const [sequence, setSequence] = useState([
    { shift_type: 'early', days: 2 },
    { shift_type: 'late', days: 2 },
    { shift_type: null, days: 1 },
  ]);

  const { shiftTypes } = useShiftTypes(selectedTeams);

  useEffect(() => {
    if (template) {
      setName(template.template_name);
      setDescription(template.description || '');
      setSelectedTeams(template.team_ids);
      setPatternType(template.pattern_type);
      setIsPublic(template.is_public);

      const config = template.pattern_config;
      if (config.type === 'fixed_days') {
        setWorkDays(config.cycle.work_days);
        setOffDays(config.cycle.off_days);
        setFixedShiftType(config.cycle.shift_type);
      } else if (config.type === 'repeating_sequence') {
        setSequence(config.sequence);
      }
    }
  }, [template]);

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const getPatternConfig = () => {
    switch (patternType) {
      case 'fixed_days':
        return {
          type: 'fixed_days' as const,
          cycle: {
            work_days: workDays,
            off_days: offDays,
            shift_type: fixedShiftType,
          },
        };
      case 'repeating_sequence':
        return {
          type: 'repeating_sequence' as const,
          sequence,
          repeat: true,
        };
      default:
        return { type: patternType };
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        template_name: name,
        description,
        team_ids: selectedTeams,
        pattern_type: patternType,
        pattern_config: getPatternConfig(),
        is_public: isPublic,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const preview = generatePatternPreview(getPatternConfig(), 28);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit' : 'Create'} Rotation Template</DialogTitle>
          <DialogDescription>
            Define a reusable shift rotation pattern for your teams
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 4-on-4-off Day Shift"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the rotation pattern"
              rows={2}
            />
          </div>

          {/* Team Selection */}
          <div className="space-y-2">
            <Label>Teams</Label>
            <div className="flex flex-wrap gap-2">
              {teams.map((team) => (
                <Badge
                  key={team.id}
                  variant={selectedTeams.includes(team.id) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleTeam(team.id)}
                >
                  {team.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Pattern Type */}
          <div className="space-y-2">
            <Label>Pattern Type</Label>
            <Select value={patternType} onValueChange={(value: any) => setPatternType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed_days">Fixed Days (X-on-Y-off)</SelectItem>
                <SelectItem value="repeating_sequence">Repeating Sequence</SelectItem>
                <SelectItem value="weekly_pattern">Weekly Pattern</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pattern Configuration */}
          {patternType === 'fixed_days' && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Days ON</Label>
                  <Input
                    type="number"
                    min={1}
                    value={workDays}
                    onChange={(e) => setWorkDays(parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Days OFF</Label>
                  <Input
                    type="number"
                    min={1}
                    value={offDays}
                    onChange={(e) => setOffDays(parseInt(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Shift Type</Label>
                <Select value={fixedShiftType} onValueChange={setFixedShiftType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes.map((shift) => (
                      <SelectItem key={shift.type} value={shift.type}>
                        {shift.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {patternType === 'repeating_sequence' && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <Label>Sequence Steps</Label>
              {sequence.map((step, index) => (
                <div key={index} className="grid grid-cols-3 gap-2">
                  <Select
                    value={step.shift_type || 'off'}
                    onValueChange={(value) => {
                      const newSequence = [...sequence];
                      newSequence[index].shift_type = value === 'off' ? null : value;
                      setSequence(newSequence);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Day Off</SelectItem>
                      {shiftTypes.map((shift) => (
                        <SelectItem key={shift.type} value={shift.type}>
                          {shift.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={step.days}
                    onChange={(e) => {
                      const newSequence = [...sequence];
                      newSequence[index].days = parseInt(e.target.value);
                      setSequence(newSequence);
                    }}
                    placeholder="Days"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSequence(sequence.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSequence([...sequence, { shift_type: 'normal', days: 1 }])}
              >
                + Add Step
              </Button>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview (Next 4 Weeks)</Label>
            <div className="grid grid-cols-7 gap-1 p-3 border rounded-lg bg-muted/50">
              {preview.map((day) => (
                <div
                  key={day.day}
                  className={`aspect-square rounded flex flex-col items-center justify-center text-xs ${
                    day.shift_type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="font-semibold">{day.label}</div>
                  <div className="text-[10px]">
                    {day.shift_type ? day.shift_type[0].toUpperCase() : 'O'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Public checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox id="public" checked={isPublic} onCheckedChange={(checked) => setIsPublic(checked as boolean)} />
            <Label htmlFor="public" className="cursor-pointer">
              Make this template public (visible to all managers)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name || selectedTeams.length === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {template ? 'Update' : 'Create'} Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
