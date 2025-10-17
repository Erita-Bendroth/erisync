# Vacation Request Workflow - Complete Implementation

## Overview
The vacation request system provides a full approval workflow for employees to request time off, with notifications sent at each step and automatic schedule updates.

## Workflow Steps

### 1. Request Submission (Employee)
**Location**: Schedule page → "Request Time Off" button

**Process**:
1. Employee selects dates (single day or date range)
2. Optionally selects specific planner for approval
3. Adds optional notes
4. System automatically:
   - Creates individual request entries for each working day (excludes weekends)
   - Groups multi-day requests using `request_group_id`
   - Sets status to "pending"
   - Sends email notification to selected planner

**Email Notification**: 
- **To**: Selected planner only
- **Content**: Employee name, date range, working days count, notes
- **Action**: Link to approval dashboard

### 2. Approval Dashboard (Planners/Managers)
**Location**: Schedule page → "Show Requests" button (red with badge when pending)

**Features**:
- **In-app notification**: Red button with badge showing pending count
- **Real-time updates**: Badge updates automatically when new requests arrive
- **Grouped display**: Multi-day requests shown as one item with date range
- **Three tabs**: Pending, Approved, Rejected
- **Request details**: Shows employee, team, dates, time (if partial day), notes

**Actions Available**:
- **Approve**: Approves entire group, creates schedule entries
- **Reject**: Opens dialog for rejection reason (optional)

### 3. Approval Process
**When planner clicks "Approve"**:

1. **Delete existing schedule entries** for all requested dates
   - Prevents conflicts with existing shifts
   - Ensures vacation takes priority

2. **Update request status**:
   - Status: "approved"
   - Approver ID: Current user
   - Approved timestamp

3. **Create vacation schedule entries**:
   - Activity type: "vacation"
   - Availability status: "unavailable"
   - Shift type: "normal"
   - Notes: Include time details and original notes

4. **Send notifications**:
   - **To requester**: Confirmation of approval
   - **To manager**: Notification of approved vacation
   - Both receive email notifications

5. **Update UI**:
   - Toast notification with success message
   - Move request to "Approved" tab
   - Update pending count badge
   - Refresh schedule view to show vacation entries

### 4. Rejection Process
**When planner clicks "Reject"**:

1. **Open rejection dialog** for optional reason
2. **Update request status**:
   - Status: "rejected"
   - Rejection reason (if provided)
   - Rejected timestamp

3. **Send notification**:
   - **To requester only**: Rejection with reason
   - Email notification sent

4. **Update UI**:
   - Move request to "Rejected" tab
   - Update pending count badge

### 5. Schedule Integration
**Vacation entries in schedule**:
- Display as "Vacation" activity
- Marked as "unavailable"
- Show time details in notes
- Cannot be edited by regular employees
- Planners/managers can still modify if needed

## Multi-Day Request Handling

### Example: 3-Week Vacation Request
**Input**: October 20 - November 7 (19 calendar days)

**Processing**:
1. System calculates working days (excludes weekends)
2. Creates individual requests for each working day (~14-15 days)
3. Groups all requests with single `request_group_id`
4. Display shows: "October 20 - November 7 (14 working days)"
5. Approval/rejection applies to entire group
6. Single notification sent (not 14 separate emails)

## Notifications

### Email Notifications
**Technology**: Resend API via edge functions

**Types**:
1. **Request Submitted**: 
   - To: Selected planner
   - Content: Request details with approval link

2. **Request Approved**:
   - To: Requester + Manager
   - Content: Confirmation with dates

3. **Request Rejected**:
   - To: Requester only
   - Content: Rejection reason (if provided)

### In-App Notifications
**Badge System**:
- Red "Show Requests" button when pending requests exist
- Badge displays count of pending requests
- Real-time updates via Supabase subscriptions
- Clears when all requests processed

## Edge Cases Handled

### ✅ Multi-Day Requests
- Correctly groups related requests
- Displays as single item with date range
- Approves/rejects entire group atomically
- Sends single notification per group

### ✅ Weekend Exclusion
- System automatically excludes Saturdays and Sundays
- Only creates requests for working days (Monday-Friday)
- Displays accurate working day count

### ✅ Overlapping Requests
- Database checks prevent double-booking
- Approval process deletes existing schedule entries first
- Vacation takes priority over regular shifts

### ✅ Concurrent Processing
- Real-time subscriptions keep all users in sync
- Optimistic UI updates with rollback on error
- Loading states prevent double-clicks

### ✅ Notification Failures
- Approval/rejection completes even if email fails
- Error toasts inform user of any issues
- Audit trail maintained in database

## Security & Permissions

### Who Can Submit Requests
- Any authenticated employee
- Must be member of at least one team

### Who Can Approve/Reject
- Users with "planner" role
- Users with "manager" role
- Can only see requests for accessible teams

### Data Privacy
- RLS policies enforce team-based access
- Managers only see their team members' requests
- Planners see all requests across organization

## Audit Trail

### Tracked Data
- **Request creation**: user_id, timestamp
- **Approval**: approver_id, approved_at timestamp
- **Rejection**: rejected_at timestamp, rejection_reason
- **Schedule changes**: created_by, updated_at

### Database Tables
- `vacation_requests`: Main request records
- `schedule_entries`: Actual vacation blocks
- `delegation_audit_log`: For delegate access tracking

## Testing Verification

### Test Case 1: Single Day Request
1. SABUN requests October 16 (single day)
2. Notification sent to ERBET (selected planner)
3. ERBET sees request in pending tab
4. ERBET approves
5. SABUN and manager receive notification
6. October 16 shows "Vacation" in schedule

### Test Case 2: Multi-Day Request
1. SABUN requests October 20-24 (5 days)
2. System creates 5 grouped requests
3. Display shows as one item
4. Single notification to ERBET
5. ERBET approves entire group
6. All 5 days updated in schedule
7. Single notification sent to SABUN and manager

### Test Case 3: Rejection
1. SABUN requests October 19
2. ERBET rejects with reason "Team already at capacity"
3. SABUN receives rejection notification with reason
4. Request moved to "Rejected" tab
5. No schedule changes made

## Technical Implementation

### Key Components
- `VacationRequestModal.tsx`: Request submission form
- `VacationRequestsList.tsx`: Approval dashboard
- `ScheduleView.tsx`: Integration with schedule display

### Edge Functions
- `vacation-request-notification`: Sends all email notifications
- Handles multi-day grouping for notifications
- Fetches user and team data for email content

### Database Schema
```sql
vacation_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  team_id uuid NOT NULL,
  requested_date date NOT NULL,
  is_full_day boolean DEFAULT true,
  start_time time,
  end_time time,
  notes text,
  status text DEFAULT 'pending',
  approver_id uuid,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  request_group_id uuid,  -- Groups multi-day requests
  selected_planner_id uuid,  -- Planner to notify
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

## Future Enhancements (Not Currently Implemented)
- Vacation balance tracking
- Auto-approval for certain conditions
- Conflict detection with team coverage
- Calendar integration (iCal export)
- Mobile push notifications
- Slack/Teams integration

## Support & Troubleshooting

### Request Not Appearing
1. Check if user is authenticated
2. Verify team membership
3. Check RLS policies allow access
4. Look for errors in browser console

### Notifications Not Sending
1. Verify RESEND_API_KEY is configured
2. Check edge function logs
3. Confirm email domain is verified in Resend
4. Check spam folder

### Badge Not Updating
1. Real-time subscription may have disconnected
2. Refresh page to reconnect
3. Check browser console for errors
4. Verify RLS policies allow count query
