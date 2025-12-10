import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CountryShiftLimit {
  id: string;
  country_code: string;
  shift_type: string;
  max_shifts_per_year: number;
  year: number;
  partnership_id: string | null;
  notes: string | null;
}

const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
];

const SHIFT_TYPES = [
  { value: 'overtime', label: 'Overtime', description: 'Weekend + Holiday combined' },
  { value: 'weekend', label: 'Weekend Shifts' },
  { value: 'holiday', label: 'Holiday Shifts' },
  { value: 'late', label: 'Late/Night Shifts' },
  { value: 'early', label: 'Early Shifts' },
];

const PRESETS = [
  { country: 'GB', shiftType: 'overtime', max: 16, label: 'UK - 16 Overtime/Year' },
  { country: 'DE', shiftType: 'weekend', max: 12, label: 'Germany - 12 Weekend/Year' },
];

export function CountryShiftLimits() {
  const [limits, setLimits] = useState<CountryShiftLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<CountryShiftLimit | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [limitToDelete, setLimitToDelete] = useState<CountryShiftLimit | null>(null);

  // Form state
  const [formCountry, setFormCountry] = useState('GB');
  const [formShiftType, setFormShiftType] = useState('overtime');
  const [formMaxShifts, setFormMaxShifts] = useState(16);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    fetchLimits();
  }, []);

  const fetchLimits = async () => {
    try {
      const { data, error } = await supabase
        .from('country_shift_limits')
        .select('*')
        .order('country_code')
        .order('year', { ascending: false })
        .order('shift_type');

      if (error) throw error;
      setLimits(data || []);
    } catch (error) {
      console.error('Error fetching limits:', error);
      toast.error('Failed to load shift limits');
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingLimit(null);
    setFormCountry('GB');
    setFormShiftType('overtime');
    setFormMaxShifts(16);
    setFormYear(new Date().getFullYear());
    setFormNotes('');
    setDialogOpen(true);
  };

  const openEditDialog = (limit: CountryShiftLimit) => {
    setEditingLimit(limit);
    setFormCountry(limit.country_code);
    setFormShiftType(limit.shift_type);
    setFormMaxShifts(limit.max_shifts_per_year);
    setFormYear(limit.year);
    setFormNotes(limit.notes || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const limitData = {
        country_code: formCountry,
        shift_type: formShiftType,
        max_shifts_per_year: formMaxShifts,
        year: formYear,
        notes: formNotes.trim() || null,
        partnership_id: null,
      };

      if (editingLimit) {
        const { error } = await supabase
          .from('country_shift_limits')
          .update(limitData)
          .eq('id', editingLimit.id);

        if (error) throw error;
        toast.success('Limit updated successfully');
      } else {
        const { error } = await supabase.from('country_shift_limits').insert(limitData);

        if (error) throw error;
        toast.success('Limit created successfully');
      }

      setDialogOpen(false);
      fetchLimits();
    } catch (error: any) {
      console.error('Error saving limit:', error);
      if (error.message?.includes('unique')) {
        toast.error('A limit for this country, shift type, and year already exists');
      } else {
        toast.error('Failed to save limit');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!limitToDelete) return;

    try {
      const { error } = await supabase
        .from('country_shift_limits')
        .delete()
        .eq('id', limitToDelete.id);

      if (error) throw error;
      toast.success('Limit deleted successfully');
      setDeleteDialogOpen(false);
      setLimitToDelete(null);
      fetchLimits();
    } catch (error) {
      console.error('Error deleting limit:', error);
      toast.error('Failed to delete limit');
    }
  };

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setFormCountry(preset.country);
    setFormShiftType(preset.shiftType);
    setFormMaxShifts(preset.max);
  };

  const getCountryInfo = (code: string) => {
    return COUNTRIES.find((c) => c.code === code) || { code, name: code, flag: '🌍' };
  };

  const getShiftTypeLabel = (type: string) => {
    return SHIFT_TYPES.find((s) => s.value === type)?.label || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Country Shift Limits</span>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Limit
            </Button>
          </CardTitle>
          <CardDescription>
            Configure maximum shift allowances per country per year. These limits help enforce
            labor regulations for overtime, weekend, and holiday shifts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {limits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No shift limits configured</p>
              <p className="text-sm">Click "Add Limit" to create your first country shift limit</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Shift Type</TableHead>
                  <TableHead>Max/Year</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {limits.map((limit) => {
                  const country = getCountryInfo(limit.country_code);
                  return (
                    <TableRow key={limit.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span>{country.flag}</span>
                          <span>{country.name}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getShiftTypeLabel(limit.shift_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{limit.max_shifts_per_year}</TableCell>
                      <TableCell>{limit.year}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {limit.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(limit)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setLimitToDelete(limit);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLimit ? 'Edit Shift Limit' : 'Add Shift Limit'}</DialogTitle>
            <DialogDescription>
              Configure maximum allowed shifts for a specific country and shift type
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Quick presets */}
            {!editingLimit && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select value={formCountry} onValueChange={setFormCountry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.flag} {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shiftType">Shift Type</Label>
                <Select value={formShiftType} onValueChange={setFormShiftType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxShifts">Maximum Shifts/Year</Label>
                <Input
                  id="maxShifts"
                  type="number"
                  min="1"
                  value={formMaxShifts}
                  onChange={(e) => setFormMaxShifts(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min="2024"
                  max="2030"
                  value={formYear}
                  onChange={(e) => setFormYear(parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g., Based on Working Time Regulations 1998"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Limit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Shift Limit</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this shift limit? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
