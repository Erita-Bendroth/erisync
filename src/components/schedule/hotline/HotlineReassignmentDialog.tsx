import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Phone, AlertTriangle, User, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HotlineReassignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  date: string;
  originalUserId: string;
  originalUserName: string;
  hotlineTimeBlock: { start_time: string; end_time: string };
  onReassigned: (newUserId: string | null) => void;
  onCancel: () => void;
}

interface EligibleMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
  isAvailable: boolean;
  unavailableReason?: string;
}

export const HotlineReassignmentDialog: React.FC<HotlineReassignmentDialogProps> = ({
  open,
  onOpenChange,
  teamId,
  date,
  originalUserId,
  originalUserName,
  hotlineTimeBlock,
  onReassigned,
  onCancel
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [eligibleMembers, setEligibleMembers] = useState<EligibleMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchEligibleMembers();
    }
  }, [open, teamId, date]);

  const fetchEligibleMembers = async () => {
    try {
      setLoading(true);

      // Get eligible members for this team
      const { data: eligibleData, error: eligibleError } = await supabase
        .from('hotline_eligible_members')
        .select(`
          user_id,
          profiles:user_id (
            first_name,
            last_name,
            initials
          )
        `)
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (eligibleError) throw eligibleError;

      // Check availability for each member on this date
      const memberChecks = await Promise.all(
        (eligibleData || []).map(async (member: any) => {
          const profile = member.profiles;
          
          // Skip the original user
          if (member.user_id === originalUserId) {
            return null;
          }

          // Check if they have any schedule entry on this date
          const { data: scheduleData } = await supabase
            .from('schedule_entries')
            .select('activity_type, notes')
            .eq('user_id', member.user_id)
            .eq('team_id', teamId)
            .eq('date', date)
            .maybeSingle();

          let isAvailable = true;
          let unavailableReason = undefined;

          if (scheduleData) {
            // Check if on vacation
            if (scheduleData.activity_type === 'vacation') {
              isAvailable = false;
              unavailableReason = 'On Vacation';
            }
            // Check if already has hotline
            else if (scheduleData.notes?.includes('"activity_type":"hotline_support"')) {
              isAvailable = false;
              unavailableReason = 'Already on Hotline';
            }
            // Check if unavailable
            else if (scheduleData.activity_type === 'out_of_office' || scheduleData.activity_type === 'other') {
              isAvailable = false;
              unavailableReason = 'Out of Office';
            }
          }

          return {
            user_id: member.user_id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            initials: profile.initials,
            isAvailable,
            unavailableReason
          };
        })
      );

      const members = memberChecks.filter(Boolean) as EligibleMember[];
      
      // Sort: available first, then by name
      members.sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) {
          return a.isAvailable ? -1 : 1;
        }
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      });

      setEligibleMembers(members);
    } catch (error) {
      console.error('Error fetching eligible members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load eligible team members',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    onReassigned(selectedUserId);
    onOpenChange(false);
  };

  const handleCancelClick = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Hotline Coverage Required
          </DialogTitle>
          <DialogDescription>
            {originalUserName} has hotline duty on {format(new Date(date), 'MMMM d, yyyy')} that needs to be reassigned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hotline time info */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Phone className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Hotline: {hotlineTimeBlock.start_time} - {hotlineTimeBlock.end_time}
            </span>
          </div>

          {/* Member selection */}
          <div className="space-y-2">
            <Label>Who should take over the hotline shift?</Label>
            
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : eligibleMembers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground border-2 border-dashed rounded-md">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No other eligible members available</p>
              </div>
            ) : (
              <RadioGroup value={selectedUserId || ''} onValueChange={setSelectedUserId}>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {eligibleMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className={`flex items-center space-x-3 p-3 rounded-md border-2 transition-colors ${
                        selectedUserId === member.user_id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      } ${!member.isAvailable ? 'opacity-60' : ''}`}
                    >
                      <RadioGroupItem
                        value={member.user_id}
                        id={member.user_id}
                        disabled={!member.isAvailable}
                      />
                      <Label
                        htmlFor={member.user_id}
                        className="flex-1 flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold">
                            {member.initials}
                          </div>
                          <span className="font-medium">
                            {member.first_name} {member.last_name}
                          </span>
                        </div>
                        {member.isAvailable ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success">
                            Available
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
                            {member.unavailableReason}
                          </Badge>
                        )}
                      </Label>
                    </div>
                  ))}

                  {/* Option to skip reassignment */}
                  <div
                    className={`flex items-center space-x-3 p-3 rounded-md border-2 transition-colors ${
                      selectedUserId === null && selectedUserId !== ''
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="skip" id="skip" onClick={() => setSelectedUserId(null)} />
                    <Label htmlFor="skip" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="font-medium">Skip reassignment (leave uncovered)</span>
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancelClick}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedUserId === ''}>
            Confirm & Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
