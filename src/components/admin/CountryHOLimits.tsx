import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useHomeOfficeLimits, HomeOfficeLimit } from '@/hooks/useHomeOfficeCompliance';
import { Home, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

const COUNTRY_FLAGS: Record<string, string> = {
  SE: '🇸🇪',
  DE: '🇩🇪',
  US: '🇺🇸',
  PL: '🇵🇱',
  BE: '🇧🇪',
  GB: '🇬🇧',
  FR: '🇫🇷',
  NL: '🇳🇱',
  AT: '🇦🇹',
  CH: '🇨🇭',
};

const LIMIT_TYPE_LABELS: Record<string, string> = {
  weekly: 'Per Week',
  monthly: 'Per Month',
  yearly: 'Per Year',
};

interface EditDialogProps {
  limit?: HomeOfficeLimit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (limit: Partial<HomeOfficeLimit> & { country_code: string }) => Promise<boolean>;
}

function EditDialog({ limit, open, onOpenChange, onSave }: EditDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<{
    country_code: string;
    limit_type: 'weekly' | 'monthly' | 'yearly';
    max_days: string;
    notes: string;
  }>({
    country_code: limit?.country_code || '',
    limit_type: limit?.limit_type || 'monthly',
    max_days: limit?.max_days?.toString() || '',
    notes: limit?.notes || '',
  });

  React.useEffect(() => {
    if (open) {
      setFormData({
        country_code: limit?.country_code || '',
        limit_type: limit?.limit_type || 'monthly',
        max_days: limit?.max_days?.toString() || '',
        notes: limit?.notes || '',
      });
    }
  }, [open, limit]);

  const handleSave = async () => {
    if (!formData.country_code || !formData.max_days) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const limitType = formData.limit_type as 'weekly' | 'monthly' | 'yearly';
    const success = await onSave({
      country_code: formData.country_code.toUpperCase(),
      limit_type: limitType,
      max_days: parseInt(formData.max_days),
      notes: formData.notes || null,
    });

    if (success) {
      toast({
        title: 'Saved',
        description: `Home Office limit for ${formData.country_code} saved successfully`,
      });
      onOpenChange(false);
    } else {
      toast({
        title: 'Error',
        description: 'Failed to save Home Office limit',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{limit ? 'Edit' : 'Add'} Home Office Limit</DialogTitle>
          <DialogDescription>
            Configure country-specific Home Office limits
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="country_code">Country Code *</Label>
            <Input
              id="country_code"
              placeholder="e.g., SE, DE, US"
              value={formData.country_code}
              onChange={(e) => setFormData({ ...formData, country_code: e.target.value.toUpperCase() })}
              maxLength={2}
              disabled={!!limit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="limit_type">Limit Type *</Label>
            <Select
              value={formData.limit_type}
              onValueChange={(value: 'weekly' | 'monthly' | 'yearly') => setFormData({ ...formData, limit_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly (per week)</SelectItem>
                <SelectItem value="monthly">Monthly (per month)</SelectItem>
                <SelectItem value="yearly">Yearly (per year)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_days">Maximum Days *</Label>
            <Input
              id="max_days"
              type="number"
              min="1"
              placeholder="e.g., 2, 10, 52"
              value={formData.max_days}
              onChange={(e) => setFormData({ ...formData, max_days: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="e.g., Company policy or regulatory reference"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CountryHOLimits() {
  const { toast } = useToast();
  const { limits, loading, saveLimit, deleteLimit } = useHomeOfficeLimits();
  const [editingLimit, setEditingLimit] = useState<HomeOfficeLimit | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deletingCountry, setDeletingCountry] = useState<string | null>(null);

  const handleDelete = async (countryCode: string) => {
    if (!confirm(`Are you sure you want to delete the Home Office limit for ${countryCode}?`)) {
      return;
    }

    setDeletingCountry(countryCode);
    const success = await deleteLimit(countryCode);
    
    if (success) {
      toast({
        title: 'Deleted',
        description: `Home Office limit for ${countryCode} deleted`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to delete Home Office limit',
        variant: 'destructive',
      });
    }
    setDeletingCountry(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Home Office Limits by Country
            </CardTitle>
            <CardDescription>
              Configure country-specific Home Office regulations (weekly, monthly, or yearly limits)
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Country
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : limits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No Home Office limits configured yet. Click "Add Country" to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Limit Type</TableHead>
                <TableHead className="text-center">Max Days</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limits.map((limit) => (
                <TableRow key={limit.id}>
                  <TableCell className="font-medium">
                    <span className="mr-2">{COUNTRY_FLAGS[limit.country_code] || '🏳️'}</span>
                    {limit.country_code}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {LIMIT_TYPE_LABELS[limit.limit_type] || limit.limit_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {limit.max_days}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {limit.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingLimit(limit)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(limit.country_code)}
                        disabled={deletingCountry === limit.country_code}
                      >
                        {deletingCountry === limit.country_code ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add Dialog */}
      <EditDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSave={saveLimit}
      />

      {/* Edit Dialog */}
      <EditDialog
        limit={editingLimit}
        open={!!editingLimit}
        onOpenChange={(open) => !open && setEditingLimit(null)}
        onSave={saveLimit}
      />
    </Card>
  );
}
