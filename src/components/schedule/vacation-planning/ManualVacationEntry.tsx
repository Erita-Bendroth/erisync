import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ManualVacationEntryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Array<{ id: string; name: string }>;
  onSuccess: () => void;
  canEditTeam: (teamId: string) => boolean;
  isAdmin: boolean;
  isPlanner: boolean;
}

export const ManualVacationEntry = ({ 
  open, 
  onOpenChange, 
  teams, 
  onSuccess,
  canEditTeam,
  isAdmin,
  isPlanner
}: ManualVacationEntryProps) => {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isFullDay, setIsFullDay] = useState(true);
  const [notes, setNotes] = useState('');
  const [approveImmediately, setApproveImmediately] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const { toast } = useToast();

  // Filter teams to only those user can edit
  const editableTeams = teams.filter(team => 
    isAdmin || isPlanner || canEditTeam(team.id)
  );

  useEffect(() => {
    if (selectedTeam) {
      loadTeamMembers(selectedTeam);
    }
  }, [selectedTeam]);

  const loadTeamMembers = async (teamId: string) => {
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          user_id,
          profiles(first_name, last_name)
        `)
        .eq('team_id', teamId);

      if (error) throw error;

      const members = data?.map(tm => ({
        id: tm.user_id,
        name: `${tm.profiles?.first_name} ${tm.profiles?.last_name}`
      })) || [];

      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive"
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTeam || !selectedUserId || !startDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Check if user can edit this team
    if (!isAdmin && !isPlanner && !canEditTeam(selectedTeam)) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to create vacation entries for this team",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      // Create vacation request(s) for date range
      const vacationDates: Date[] = [];
      if (endDate && endDate > startDate) {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          vacationDates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        vacationDates.push(startDate);
      }

      const requests = vacationDates.map(date => ({
        user_id: selectedUserId,
        team_id: selectedTeam,
        requested_date: format(date, 'yyyy-MM-dd'),
        is_full_day: isFullDay,
        status: approveImmediately ? 'approved' : 'pending',
        notes,
        approver_id: approveImmediately ? currentUserId : null,
        approved_at: approveImmediately ? new Date().toISOString() : null
      }));

      const { error } = await supabase
        .from('vacation_requests')
        .insert(requests);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${vacationDates.length} vacation ${vacationDates.length > 1 ? 'requests' : 'request'} created successfully`
      });

      // Reset form
      setSelectedTeam('');
      setSelectedUserId('');
      setStartDate(undefined);
      setEndDate(undefined);
      setNotes('');
      setApproveImmediately(false);
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating vacation request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create vacation request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Vacation Entry</DialogTitle>
          <DialogDescription>
            Manually create a vacation request or pre-approved vacation for a team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Team</Label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {editableTeams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Team Member</Label>
            <Select 
              value={selectedUserId} 
              onValueChange={setSelectedUserId}
              disabled={!selectedTeam || loadingMembers}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingMembers ? "Loading..." : "Select team member"} />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="full-day"
              checked={isFullDay}
              onCheckedChange={setIsFullDay}
            />
            <Label htmlFor="full-day">Full Day</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="approve"
              checked={approveImmediately}
              onCheckedChange={setApproveImmediately}
            />
            <Label htmlFor="approve">Approve Immediately</Label>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this vacation..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedTeam || !selectedUserId || !startDate}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Vacation Entry
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
