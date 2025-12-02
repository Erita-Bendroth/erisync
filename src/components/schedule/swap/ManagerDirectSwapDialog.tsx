import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface ScheduleEntry {
  id: string;
  date: string;
  shift_type: string | null;
  user_id: string;
}

interface ManagerDirectSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ManagerDirectSwapDialog({ open, onOpenChange, onSuccess }: ManagerDirectSwapDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [employeeA, setEmployeeA] = useState<string>('');
  const [employeeB, setEmployeeB] = useState<string>('');
  const [dateA, setDateA] = useState<string>('');
  const [dateB, setDateB] = useState<string>('');
  const [entriesA, setEntriesA] = useState<ScheduleEntry[]>([]);
  const [entriesB, setEntriesB] = useState<ScheduleEntry[]>([]);
  const [selectedEntryA, setSelectedEntryA] = useState<string>('');
  const [selectedEntryB, setSelectedEntryB] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [notifyEmployees, setNotifyEmployees] = useState(true);

  useEffect(() => {
    if (open && user) {
      fetchTeamMembers();
    }
  }, [open, user]);

  useEffect(() => {
    if (employeeA && dateA) {
      fetchEntriesForEmployee(employeeA, dateA, setEntriesA);
    } else {
      setEntriesA([]);
      setSelectedEntryA('');
    }
  }, [employeeA, dateA]);

  useEffect(() => {
    if (employeeB && dateB) {
      fetchEntriesForEmployee(employeeB, dateB, setEntriesB);
    } else {
      setEntriesB([]);
      setSelectedEntryB('');
    }
  }, [employeeB, dateB]);

  const fetchTeamMembers = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: accessibleTeams } = await supabase.rpc('get_manager_accessible_teams', {
        _manager_id: user.id
      });

      if (!accessibleTeams || accessibleTeams.length === 0) {
        toast({
          title: 'No Access',
          description: 'You do not have access to any teams',
          variant: 'destructive'
        });
        return;
      }

      const { data: members } = await supabase
        .from('team_members')
        .select(`
          user_id,
          profiles!team_members_user_id_fkey(first_name, last_name)
        `)
        .in('team_id', accessibleTeams);

      if (members) {
        const uniqueMembers = Array.from(
          new Map(
            members.map((m: any) => [
              m.user_id,
              {
                user_id: m.user_id,
                first_name: m.profiles?.first_name || '',
                last_name: m.profiles?.last_name || ''
              }
            ])
          ).values()
        );
        setTeamMembers(uniqueMembers);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEntriesForEmployee = async (
    userId: string,
    date: string,
    setEntries: (entries: ScheduleEntry[]) => void
  ) => {
    const { data, error } = await supabase
      .from('schedule_entries')
      .select('id, date, shift_type, user_id')
      .eq('user_id', userId)
      .eq('date', date);

    if (error) {
      console.error('Error fetching entries:', error);
      return;
    }

    setEntries(data || []);
  };

  const getShiftLabel = (shiftType: string | null) => {
    if (!shiftType) return 'Normal';
    const labels: Record<string, string> = {
      early: 'Early',
      late: 'Late',
      normal: 'Normal',
      weekend: 'Weekend'
    };
    return labels[shiftType] || 'Normal';
  };

  const handleSwap = async () => {
    if (!selectedEntryA || !selectedEntryB || !user) {
      toast({
        title: 'Incomplete Selection',
        description: 'Please select both employees and their shifts',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      // Fetch both entries
      const { data: entries } = await supabase
        .from('schedule_entries')
        .select('*')
        .in('id', [selectedEntryA, selectedEntryB]);

      if (!entries || entries.length !== 2) {
        throw new Error('Failed to fetch schedule entries');
      }

      const entryA = entries.find(e => e.id === selectedEntryA);
      const entryB = entries.find(e => e.id === selectedEntryB);

      if (!entryA || !entryB) {
        throw new Error('Invalid entries');
      }

      const isSameDate = entryA.date === entryB.date;

      if (isSameDate) {
        // Same date: swap shift types
        await supabase
          .from('schedule_entries')
          .update({
            shift_type: entryB.shift_type,
            notes: `Shift swapped by manager on ${format(new Date(), 'MMM d, yyyy')}${notes ? ': ' + notes : ''}`
          })
          .eq('id', selectedEntryA);

        await supabase
          .from('schedule_entries')
          .update({
            shift_type: entryA.shift_type,
            notes: `Shift swapped by manager on ${format(new Date(), 'MMM d, yyyy')}${notes ? ': ' + notes : ''}`
          })
          .eq('id', selectedEntryB);
      } else {
        // Cross-date: swap user assignments
        await supabase
          .from('schedule_entries')
          .update({
            user_id: entryB.user_id,
            notes: `Shift swapped by manager on ${format(new Date(), 'MMM d, yyyy')}${notes ? ': ' + notes : ''}`
          })
          .eq('id', selectedEntryA);

        await supabase
          .from('schedule_entries')
          .update({
            user_id: entryA.user_id,
            notes: `Shift swapped by manager on ${format(new Date(), 'MMM d, yyyy')}${notes ? ': ' + notes : ''}`
          })
          .eq('id', selectedEntryB);
      }

      // Send notifications if enabled
      if (notifyEmployees) {
        const { data: managerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .single();

        await supabase.functions.invoke('send-swap-notification', {
          body: {
            type: 'manager_direct_swap',
            requesting_user_id: employeeA,
            target_user_id: employeeB,
            swap_date: dateA,
            swap_date_b: dateB,
            team_id: entryA.team_id,
            review_notes: notes.trim() || null,
            manager_name: managerProfile ? `${managerProfile.first_name} ${managerProfile.last_name}` : 'Manager'
          }
        });
      }

      toast({
        title: 'Swap Complete',
        description: `Shifts successfully swapped between employees`
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error swapping shifts:', error);
      toast({
        title: 'Error',
        description: 'Failed to swap shifts',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setEmployeeA('');
    setEmployeeB('');
    setDateA('');
    setDateB('');
    setEntriesA([]);
    setEntriesB([]);
    setSelectedEntryA('');
    setSelectedEntryB('');
    setNotes('');
    setNotifyEmployees(true);
    onOpenChange(false);
  };

  const selectedMemberA = teamMembers.find(m => m.user_id === employeeA);
  const selectedMemberB = teamMembers.find(m => m.user_id === employeeB);
  const entryA = entriesA.find(e => e.id === selectedEntryA);
  const entryB = entriesB.find(e => e.id === selectedEntryB);

  const canSwap = selectedEntryA && selectedEntryB && employeeA !== employeeB;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manager Direct Swap</DialogTitle>
          <DialogDescription>
            Directly swap shifts between two employees without requiring their approval
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Employee A Selection */}
            <div className="p-4 border rounded-lg space-y-4">
              <h3 className="font-medium">Employee A</h3>
              
              <div className="space-y-2">
                <Label>Select Employee</Label>
                <Select value={employeeA} onValueChange={setEmployeeA}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(member => (
                      <SelectItem 
                        key={member.user_id} 
                        value={member.user_id}
                        disabled={member.user_id === employeeB}
                      >
                        {member.first_name} {member.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <input
                  type="date"
                  value={dateA}
                  onChange={(e) => setDateA(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              {entriesA.length > 0 && (
                <div className="space-y-2">
                  <Label>Shift</Label>
                  <Select value={selectedEntryA} onValueChange={setSelectedEntryA}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose shift..." />
                    </SelectTrigger>
                    <SelectContent>
                      {entriesA.map(entry => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {getShiftLabel(entry.shift_type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Swap Arrow */}
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-muted">
                <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>

            {/* Employee B Selection */}
            <div className="p-4 border rounded-lg space-y-4">
              <h3 className="font-medium">Employee B</h3>
              
              <div className="space-y-2">
                <Label>Select Employee</Label>
                <Select value={employeeB} onValueChange={setEmployeeB}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(member => (
                      <SelectItem 
                        key={member.user_id} 
                        value={member.user_id}
                        disabled={member.user_id === employeeA}
                      >
                        {member.first_name} {member.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <input
                  type="date"
                  value={dateB}
                  onChange={(e) => setDateB(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              {entriesB.length > 0 && (
                <div className="space-y-2">
                  <Label>Shift</Label>
                  <Select value={selectedEntryB} onValueChange={setSelectedEntryB}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose shift..." />
                    </SelectTrigger>
                    <SelectContent>
                      {entriesB.map(entry => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {getShiftLabel(entry.shift_type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Preview */}
            {canSwap && entryA && entryB && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Preview</h4>
                <p className="text-sm">
                  <span className="font-medium">{selectedMemberA?.first_name}'s</span> {getShiftLabel(entryA.shift_type)} shift on {format(new Date(dateA), 'MMM d, yyyy')}
                  {' '}↔{' '}
                  <span className="font-medium">{selectedMemberB?.first_name}'s</span> {getShiftLabel(entryB.shift_type)} shift on {format(new Date(dateB), 'MMM d, yyyy')}
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for swap..."
                rows={3}
              />
            </div>

            {/* Notification Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify"
                checked={notifyEmployees}
                onCheckedChange={(checked) => setNotifyEmployees(checked as boolean)}
              />
              <Label htmlFor="notify" className="cursor-pointer">
                Notify employees of this change
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            Cancel
          </Button>
          <Button 
            onClick={handleSwap} 
            disabled={!canSwap || processing}
          >
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Execute Swap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
