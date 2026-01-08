import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfDay } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, Check, ArrowRight, Gift } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TargetShift } from './SwapTargetSelector';

export interface OfferShift {
  entryId: string;
  date: string;
  shiftType: string;
  teamId: string;
  teamName: string;
}

interface SwapOfferSelectorProps {
  currentUserId: string;
  teamIds: string[];
  targetShift: TargetShift;
  selectedOffer: OfferShift | null;
  onSelectOffer: (shift: OfferShift | null) => void;
  skipOffer: boolean;
  onSkipOfferChange: (skip: boolean) => void;
}

const SHIFT_LABELS: Record<string, string> = {
  normal: 'Normal',
  early: 'Early',
  late: 'Late',
  night: 'Night',
  oncall: 'On-Call',
  weekend: 'Weekend',
  flex: 'Flex',
};

export function SwapOfferSelector({
  currentUserId,
  teamIds,
  targetShift,
  selectedOffer,
  onSelectOffer,
  skipOffer,
  onSkipOfferChange,
}: SwapOfferSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [myShifts, setMyShifts] = useState<OfferShift[]>([]);

  useEffect(() => {
    fetchMyShifts();
  }, [currentUserId, teamIds]);

  const fetchMyShifts = async () => {
    setLoading(true);
    try {
      const today = startOfDay(new Date());
      const endDate = addDays(today, 60); // Look ahead 60 days for offering

      const { data: entries, error } = await supabase
        .from('schedule_entries')
        .select(`
          id,
          date,
          shift_type,
          team_id,
          availability_status,
          teams!inner(name)
        `)
        .eq('user_id', currentUserId)
        .gte('date', format(today, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .eq('availability_status', 'available')
        .in('shift_type', ['normal', 'early', 'late', 'weekend'])
        .order('date', { ascending: true });

      if (error) throw error;

      const formattedShifts: OfferShift[] = (entries || []).map(entry => ({
        entryId: entry.id,
        date: entry.date,
        shiftType: entry.shift_type || 'normal',
        teamId: entry.team_id,
        teamName: (entry.teams as any)?.name || 'Unknown Team',
      }));

      setMyShifts(formattedShifts);
    } catch (error) {
      console.error('Error fetching my shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipChange = (checked: boolean) => {
    onSkipOfferChange(checked);
    if (checked) {
      onSelectOffer(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* What you're requesting */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <p className="text-sm font-medium text-primary mb-2">You're requesting:</p>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
            {targetShift.userInitials}
          </div>
          <div>
            <p className="font-medium">{targetShift.userName}'s shift</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(targetShift.date), 'EEE, MMM d')} • {SHIFT_LABELS[targetShift.shiftType] || targetShift.shiftType}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground">
          <strong>Step 2:</strong> Optionally offer one of your shifts in exchange. 
          This makes it a true swap where you exchange shifts.
        </p>
      </div>

      {/* Skip option */}
      <Card className={cn(
        'cursor-pointer transition-all',
        skipOffer && 'border-primary bg-primary/5'
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="skip-offer"
              checked={skipOffer}
              onCheckedChange={handleSkipChange}
            />
            <div className="flex-1">
              <Label htmlFor="skip-offer" className="font-medium cursor-pointer">
                Don't offer a shift in return
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                You're just asking to take over this shift without offering one of yours.
                The other person keeps their schedule unchanged.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!skipOffer && (
        <>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Gift className="h-4 w-4 text-primary" />
            <span>Or select a shift to offer:</span>
          </div>

          {/* My shifts list */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {myShifts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>You have no upcoming work shifts to offer.</p>
              </div>
            ) : (
              myShifts.map(shift => {
                const isSelected = selectedOffer?.entryId === shift.entryId;
                const isSameDate = shift.date === targetShift.date;
                
                return (
                  <Card
                    key={shift.entryId}
                    className={cn(
                      'cursor-pointer transition-all hover:border-primary/50',
                      isSelected && 'border-primary bg-primary/5 ring-1 ring-primary'
                    )}
                    onClick={() => onSelectOffer(isSelected ? null : shift)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center text-center min-w-[50px]">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(shift.date), 'EEE')}
                          </span>
                          <span className="text-lg font-bold">
                            {format(new Date(shift.date), 'd')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(shift.date), 'MMM')}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">
                              {SHIFT_LABELS[shift.shiftType] || shift.shiftType}
                            </span>
                            {isSameDate && (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-200">
                                Same day
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{shift.teamName}</p>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Preview of the swap */}
      {(selectedOffer || skipOffer) && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-3">Swap Preview:</p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">You give</p>
              <div className="px-3 py-2 bg-background rounded border">
                {skipOffer ? (
                  <span className="text-muted-foreground italic">Nothing</span>
                ) : (
                  <>
                    <p className="font-medium">{format(new Date(selectedOffer!.date), 'MMM d')}</p>
                    <p className="text-sm text-muted-foreground">
                      {SHIFT_LABELS[selectedOffer!.shiftType]}
                    </p>
                  </>
                )}
              </div>
            </div>
            
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">You get</p>
              <div className="px-3 py-2 bg-primary/10 rounded border border-primary/20">
                <p className="font-medium text-primary">{format(new Date(targetShift.date), 'MMM d')}</p>
                <p className="text-sm text-primary/80">
                  {SHIFT_LABELS[targetShift.shiftType]}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
