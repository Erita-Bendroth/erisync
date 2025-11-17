import { supabase } from '@/integrations/supabase/client';

export interface SwapValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Checks if two teams are in the same planning partnership
 */
async function areTeamsInPartnership(teamIdA: string, teamIdB: string): Promise<boolean> {
  if (teamIdA === teamIdB) return true; // Same team always valid
  
  const { data, error } = await supabase
    .from('team_planning_partners')
    .select('team_ids')
    .contains('team_ids', [teamIdA])
    .contains('team_ids', [teamIdB]);
  
  if (error) {
    console.error('Error checking partnership:', error);
    return false;
  }
  
  return data && data.length > 0;
}

/**
 * Validates if a shift swap request can be created
 */
export async function validateSwapRequest(
  requestingUserId: string,
  requestingEntryId: string,
  targetUserId: string,
  targetEntryId: string,
  swapDate: Date,
  teamId: string
): Promise<SwapValidationResult> {
  // Check if users are different
  if (requestingUserId === targetUserId) {
    return { valid: false, error: 'Cannot swap with yourself' };
  }

  // Check if date is in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (swapDate < today) {
    return { valid: false, error: 'Cannot swap shifts in the past' };
  }

  // Fetch both schedule entries
  const { data: entries, error: entriesError } = await supabase
    .from('schedule_entries')
    .select('id, user_id, date, shift_type, activity_type, availability_status, team_id')
    .in('id', [requestingEntryId, targetEntryId]);

  if (entriesError || !entries || entries.length !== 2) {
    return { valid: false, error: 'Failed to fetch schedule entries' };
  }

  const requestingEntry = entries.find(e => e.id === requestingEntryId);
  const targetEntry = entries.find(e => e.id === targetEntryId);

  if (!requestingEntry || !targetEntry) {
    return { valid: false, error: 'Schedule entries not found' };
  }

  // Validate teams are in partnership
  const teamsInPartnership = await areTeamsInPartnership(
    requestingEntry.team_id,
    targetEntry.team_id
  );

  if (!teamsInPartnership) {
    return { 
      valid: false, 
      error: 'Users must be in the same team or in a planning partnership' 
    };
  }

  // Verify the requesting user's team matches the provided teamId
  if (requestingEntry.team_id !== teamId) {
    return { valid: false, error: 'Invalid team ID for requesting user' };
  }

  // Validate both entries are on the same date
  if (requestingEntry.date !== targetEntry.date) {
    return { valid: false, error: 'Shifts must be on the same date' };
  }

  // Validate shifts are swappable (must be work activities)
  const nonSwappableActivities = ['vacation', 'sick', 'out_of_office'];
  if (nonSwappableActivities.includes(requestingEntry.activity_type)) {
    return { valid: false, error: 'Your shift is not available for swapping' };
  }
  if (nonSwappableActivities.includes(targetEntry.activity_type)) {
    return { valid: false, error: 'Target shift is not available for swapping' };
  }

  // Check availability status
  if (requestingEntry.availability_status !== 'available' || targetEntry.availability_status !== 'available') {
    return { valid: false, error: 'Both shifts must be available' };
  }

  // Check for existing pending swap requests for the same date/users
  const { data: existingSwaps, error: swapsError } = await supabase
    .from('shift_swap_requests')
    .select('id')
    .eq('swap_date', swapDate.toISOString().split('T')[0])
    .eq('status', 'pending')
    .or(`requesting_user_id.eq.${requestingUserId},target_user_id.eq.${requestingUserId}`)
    .or(`requesting_user_id.eq.${targetUserId},target_user_id.eq.${targetUserId}`);

  if (swapsError) {
    return { valid: false, error: 'Failed to check for existing swap requests' };
  }

  if (existingSwaps && existingSwaps.length > 0) {
    return { valid: false, error: 'A pending swap request already exists for this date' };
  }

  return { valid: true };
}

/**
 * Validates if a swap request can be approved
 */
export async function validateSwapApproval(swapRequestId: string): Promise<SwapValidationResult> {
  // Fetch the swap request
  const { data: swapRequest, error: swapError } = await supabase
    .from('shift_swap_requests')
    .select('*')
    .eq('id', swapRequestId)
    .single();

  if (swapError || !swapRequest) {
    return { valid: false, error: 'Swap request not found' };
  }

  if (swapRequest.status !== 'pending') {
    return { valid: false, error: 'Swap request has already been processed' };
  }

  // Verify both schedule entries still exist and haven't been modified
  const { data: entries, error: entriesError } = await supabase
    .from('schedule_entries')
    .select('id, user_id, date, shift_type, activity_type, availability_status')
    .in('id', [swapRequest.requesting_entry_id, swapRequest.target_entry_id]);

  if (entriesError || !entries || entries.length !== 2) {
    return { valid: false, error: 'One or both schedule entries no longer exist' };
  }

  const requestingEntry = entries.find(e => e.id === swapRequest.requesting_entry_id);
  const targetEntry = entries.find(e => e.id === swapRequest.target_entry_id);

  if (!requestingEntry || !targetEntry) {
    return { valid: false, error: 'Schedule entries not found' };
  }

  // Verify shifts are still swappable
  const nonSwappableActivities = ['vacation', 'sick', 'out_of_office'];
  if (nonSwappableActivities.includes(requestingEntry.activity_type) || 
      nonSwappableActivities.includes(targetEntry.activity_type)) {
    return { valid: false, error: 'One or both shifts are no longer available for swapping' };
  }

  if (requestingEntry.availability_status !== 'available' || 
      targetEntry.availability_status !== 'available') {
    return { valid: false, error: 'One or both shifts are no longer available' };
  }

  return { valid: true };
}
