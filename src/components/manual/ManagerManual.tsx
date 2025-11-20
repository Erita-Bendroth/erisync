import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
export const ManagerManual = () => {
  return <div className="space-y-8">
      <section id="getting-started">
        <h2 className="text-2xl font-bold mb-4">1. Getting Started</h2>
        <p className="text-muted-foreground mb-4">
          As a Manager, you can manage schedules for your assigned teams, approve vacation requests, 
          and assign roles to team members. This guide covers everything you need to know.
        </p>
        
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Your Permissions</AlertTitle>
          <AlertDescription>
            Managers can view and edit schedules for assigned teams, approve vacation requests, 
            and assign Manager or Team Member roles. You cannot create teams or assign Planner/Admin roles.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="dashboard">
        <h2 className="text-2xl font-bold mb-4">2. Your Dashboard</h2>
        
        <h3 className="text-xl font-semibold mb-3">Dashboard Overview</h3>
        <p className="mb-4">Your dashboard provides quick access to:</p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Today's Schedule:</strong> Quick view of who's working today</li>
          
          <li><strong>Team Availability:</strong> Who's available and who's on leave</li>
          <li><strong>Quick Actions:</strong> Common tasks like creating schedule entries</li>
        </ul>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Delegation Indicator</AlertTitle>
          <AlertDescription>
            If a planner has delegated team management to you, you'll see a banner showing 
            which teams and the delegation period.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="schedule-management">
        <h2 className="text-2xl font-bold mb-4">3. Schedule Management</h2>
        
        <h3 className="text-xl font-semibold mb-3">Viewing Team Schedules</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule</strong></li>
          <li>Select your team from the dropdown</li>
          <li>View the calendar in daily, weekly, or monthly format</li>
          <li>Use filters to show specific team members or date ranges</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Creating Schedule Entries</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click on a date in the calendar or use <strong>"Add Schedule Entry"</strong></li>
          <li>Select the team member</li>
          <li>Choose date and shift type (Working, Vacation, Sick, Training, Other)</li>
          <li>Select shift time: Day (8:00-16:30), Early (6:00-14:00), Late (14:00-22:00), Night (22:00-06:00), or custom</li>
          <li>Add optional notes</li>
          <li>Click <strong>"Create Schedule Entry"</strong></li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Bulk Schedule Generator (Wizard)</h3>
        <p className="mb-4">
          The Bulk Schedule Generator uses a guided, step-by-step wizard to help you create schedules efficiently across multiple days and team members.
        </p>

        <div className="bg-accent/20 border border-accent/40 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-2">Step 1: Mode Selection</h4>
          <p className="text-sm mb-2">Choose how you want to create schedules:</p>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li><strong>Assign to Multiple Users:</strong> Schedule same shifts for selected people across date range</li>
            <li><strong>Assign to Entire Team:</strong> Schedule whole team for specific dates</li>
            <li><strong>Rotation Schedule:</strong> Create repeating rotation patterns (Advanced)</li>
          </ul>
        </div>

        <div className="bg-accent/20 border border-accent/40 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-2">Step 2: Select Team & People</h4>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li>Choose the team from dropdown (required)</li>
            <li>Select specific people using checkboxes (for Users mode)</li>
            <li>Use <strong>"Select All"</strong> / <strong>"Deselect All"</strong> for quick selection</li>
          </ul>
        </div>

        <div className="bg-accent/20 border border-accent/40 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-2">Step 3: Date Range</h4>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li>Select start and end dates using visual calendar</li>
            <li>Quick select buttons: "This Week", "Next 2 Weeks", "This Month"</li>
            <li>Toggle options: Skip Weekends, Skip Public Holidays</li>
          </ul>
        </div>

        <div className="bg-accent/20 border border-accent/40 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-2">Step 4: Shift Configuration</h4>
          <p className="text-sm mb-2">Choose from preset shift times or create custom times</p>
        </div>

        <div className="bg-accent/20 border border-accent/40 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-2">Step 5: Review & Generate</h4>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li>Review all selections</li>
            <li>Preview calendar showing first 14 days with user initials and shift info</li>
            <li>Click <strong>"Generate Schedule"</strong></li>
          </ul>
        </div>

        <h3 className="text-xl font-semibold mb-3">Editing Schedule Entries</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click on any schedule entry in the calendar</li>
          <li>Modify date, time block, shift type, or notes</li>
          <li>Click <strong>"Update"</strong></li>
          <li>Consider notifying the affected team member of changes</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Team Favorites</h3>
        <p className="mb-2">Quick access to frequently used team combinations:</p>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Select multiple teams you work with regularly</li>
          <li>Click the star icon to save as favorite</li>
          <li>Access favorites from the dropdown for instant team selection</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Understanding Shift Types</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Working:</strong> Regular work shift</li>
          <li><strong>Vacation:</strong> Approved time off</li>
          
          <li><strong>Training:</strong> Training or development activities</li>
          <li><strong>Other:</strong> Other scheduled activities</li>
        </ul>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Monthly vs. Weekly View</AlertTitle>
          <AlertDescription>
            Use the monthly view for overview planning and weekly view for detailed scheduling. 
            The weekly view shows more details about each shift.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3 mt-6">Navigating Wide Schedules</h3>
        <p className="mb-4">
          When viewing schedules spanning many days, use these navigation features:
        </p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Mouse Wheel:</strong> Scroll horizontally with your mouse wheel</li>
          <li><strong>Trackpad:</strong> Two-finger horizontal swipe on trackpad</li>
          <li><strong>Click & Drag:</strong> Click and drag to scroll through dates</li>
          <li><strong>Scrollbar:</strong> Use the horizontal scrollbar at the bottom</li>
        </ul>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Viewing Many Days</AlertTitle>
          <AlertDescription>
            The scheduler adjusts automatically when viewing more than 14 days, enabling smooth 
            horizontal scrolling to navigate through all dates.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="team-management">
        <h2 className="text-2xl font-bold mb-4">4. Team Management</h2>
        
        <h3 className="text-xl font-semibold mb-3">Viewing Your Team Members</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Team Management</strong></li>
          <li>View list of all members in your team</li>
          <li>See each member's role and current status</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Checking Team Availability</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Use the <strong>Team Availability View</strong></li>
          <li>See who's working, on vacation, or sick</li>
          <li>Identify potential coverage gaps</li>
          <li>Plan accordingly for upcoming periods</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Team Capacity Overview</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>View current capacity utilization</li>
          <li>See shift distribution across your team</li>
          <li>Monitor fairness in shift assignments</li>
        </ul>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Team Creation</AlertTitle>
          <AlertDescription>
            Managers cannot create or delete teams. Contact your planner to create new teams 
            or modify team structure.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="shift-swaps">
        <h2 className="text-2xl font-bold mb-4">5. Shift Swap Requests</h2>
        
        <p className="text-muted-foreground mb-4">
          Team members can request to swap shifts with their colleagues. As a Manager, you can 
          approve or reject swap requests for your teams to ensure proper coverage and coordination.
        </p>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Manager Approval Authority</AlertTitle>
          <AlertDescription>
            Managers can approve or reject shift swap requests for their assigned teams. Planners 
            and Admins can approve swaps across all teams.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3 mt-4">How Team Members Request Swaps</h3>
        <p className="mb-4">
          Team members can request to swap shifts by clicking the "Swap" button on a colleague's 
          schedule entry (future dates only, not their own shifts).
        </p>

        <h3 className="text-xl font-semibold mb-3">Viewing Swap Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Shift Swaps</strong></li>
          <li>See pending swap requests from your team members</li>
          <li>Review details: requesting user, target user, shift, date, and reason</li>
          <li>Monitor status: pending, approved, or rejected</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Approving or Rejecting Swaps</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click on a pending swap request to review</li>
          <li>Verify both team members can work the swapped shifts</li>
          <li>Check that team coverage won't be negatively impacted</li>
          <li>Click <strong>"Approve"</strong> or <strong>"Reject"</strong></li>
          <li>Add optional notes explaining your decision (recommended for rejections)</li>
          <li>Submit your decision</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">What Happens When Approved</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Schedule entries are automatically swapped between the two users</li>
          <li>Both users receive notification of approval</li>
          <li>Calendar updates immediately to reflect the swap</li>
          <li>Swap is logged for audit purposes</li>
        </ul>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Before Approving Swaps</AlertTitle>
          <AlertDescription>
            Always verify that both team members are qualified for the swapped shifts and that 
            team coverage requirements are maintained. Consider training, certification, and 
            seniority requirements.
          </AlertDescription>
        </Alert>

        
        
        <ol className="list-decimal list-inside space-y-2 mb-4">
          
          
          
          
          
        </ol>

        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Proactive Management</AlertTitle>
          <AlertDescription>
            Review swap requests regularly and provide timely feedback to your team members.   
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="vacation-requests">
        <h2 className="text-2xl font-bold mb-4">6. Vacation Request Management</h2>
        
        <Alert className="bg-primary/5 border-primary/20 mb-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Manager Approval Authority</AlertTitle>
          <AlertDescription>
            As a manager, you can approve or reject vacation requests for your team members. After you approve a request, parent team planners are notified for capacity planning purposes.
          </AlertDescription>
        </Alert>
        
        <h3 className="text-xl font-semibold mb-3">Approving Vacation Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to the <strong>Schedule</strong> page</li>
          <li>Click <strong>"My Requests"</strong> to view pending vacation requests</li>
          <li>Review each request including dates, duration, and notes</li>
          <li>Check team capacity for the requested dates</li>
          <li>Click <strong>"Approve"</strong> to grant the vacation</li>
          <li>The requester will receive an email notification</li>
          <li>Parent team planners are automatically notified for oversight</li>
        </ol>
        
        <h3 className="text-xl font-semibold mb-3">Rejecting Vacation Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Review the request carefully</li>
          <li>Click <strong>"Reject"</strong> on the request</li>
          <li>Provide a clear reason for rejection</li>
          <li>The requester will receive an email with your reason</li>
          <li>Consider discussing with the team member if needed</li>
        </ol>
        
        <h3 className="text-xl font-semibold mb-3">What Happens After Approval</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Approved vacation automatically replaces existing schedule entries</li>
          <li>The vacation appears on the schedule for all team members</li>
          <li>Parent team planners receive a notification for capacity planning</li>
          <li>The approval is logged in the system audit trail</li>
        </ul>
        
        <h3 className="text-xl font-semibold mb-3">Relationship with Planners</h3>
        <p className="mb-2">
          While you approve requests for your direct team, planners in your parent team receive notifications after approval. This allows them to:
        </p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Monitor overall capacity across multiple teams</li>
          <li>Plan for cross-team coverage if needed</li>
          <li>Coordinate with other managers on staffing</li>
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          Planners and admins also have the ability to approve/reject requests if needed for oversight purposes.
        </p>
      </section>

      <Separator />

      <section id="planning-partnerships">
        <h2 className="text-2xl font-bold mb-4">4.5 Planning Partnerships</h2>
        
        <p className="text-muted-foreground mb-4">
          Planning Partnerships enable coordinated scheduling across multiple teams, providing 
          visibility and ensuring adequate combined coverage.
        </p>

        <h3 className="text-xl font-semibold mb-3">Understanding Partnerships</h3>
        <p className="mb-4">
          Partnerships are created by Planners to connect teams that need to coordinate coverage, 
          such as cross-functional teams, backup teams, or teams sharing responsibilities.
        </p>

        <h3 className="text-xl font-semibold mb-3">Viewing Partner Team Schedules</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Multi-Team View</strong></li>
          <li>Select a partnership from the dropdown</li>
          <li>View schedules for all teams in the partnership</li>
          <li>See combined coverage across teams</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Using the Shared Planning Calendar</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Access partner team availability when planning your team's schedule</li>
          <li>Coordinate vacation and time-off to maintain coverage</li>
          <li>View capacity warnings across the partnership</li>
          <li>Create schedules considering partner team availability</li>
        </ul>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Cross-Team Coordination</AlertTitle>
          <AlertDescription>
            Partnerships help prevent situations where multiple teams have low coverage simultaneously, 
            ensuring business continuity across functional areas.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="vacation-requests">
        <h2 className="text-2xl font-bold mb-4">6. Vacation Requests</h2>
        
        

        <h3 className="text-xl font-semibold mb-3">Viewing Your Team's Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Vacation Requests</strong></li>
          <li>View pending requests from your team members</li>
          <li>See request details: dates, duration, notes</li>
          <li>Check team availability for the requested dates</li>
        </ol>

        <div className="my-4">
          
        </div>

        <h3 className="text-xl font-semibold mb-3">What You Can Do</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>View:</strong> See all vacation requests from your team members</li>
          <li><strong>Monitor:</strong> Track pending, approved, and rejected requests</li>
          <li><strong>Coordinate:</strong> Contact planners to expedite important requests</li>
          <li><strong>Plan:</strong> Use request information to plan team coverage</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Communicating with Planners</h3>
        <p className="mb-4">
          If you need a vacation request approved or have input on a request:
        </p>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Review the request and check team coverage</li>
          <li>Contact your Planner or Admin</li>
          <li>Provide context: coverage status, business needs, urgency</li>
          
        </ol>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Multi-Day Vacations</AlertTitle>
          <AlertDescription>
            Multi-day vacation requests automatically exclude weekends. The system calculates 
            working days only and creates individual vacation entries for each day when approved.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="role-management">
        <h2 className="text-2xl font-bold mb-4">7. Role Management</h2>
        
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Managers Cannot Assign Roles</AlertTitle>
          <AlertDescription>
            As a Manager, you can view the roles of users in your teams, but you cannot 
            assign or modify roles. Only Planners and Admins can manage user roles.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3">What You Can Do</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>View Roles:</strong> See which roles your team members have</li>
          <li><strong>Understand Permissions:</strong> Know who can do what on your team</li>
          <li><strong>Request Changes:</strong> Contact a Planner to request role changes</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Role Types in the System</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Admin/Planner:</strong> Full system access, can manage users and roles</li>
          <li><strong>Manager:</strong> Can manage team schedules, view vacation requests</li>
          <li><strong>Team Member:</strong> Can view schedules and submit vacation requests</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Requesting Role Changes</h3>
        <p className="mb-4">
          If you need to change a team member's role:
        </p>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Contact your Planner or Admin</li>
          <li>Explain which user needs a role change and why</li>
          <li>The Planner will make the change in the system</li>
        </ol>
      </section>

      <Separator />

      <section id="notifications">
        <h2 className="text-2xl font-bold mb-4">8. Notifications</h2>
        
        <h3 className="text-xl font-semibold mb-3">Sending Schedule Summaries</h3>
        <p className="mb-2"><strong>Individual Notifications:</strong></p>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule</strong></li>
          <li>Click <strong>"Send 2-Week Schedule"</strong></li>
          <li>Select team member and date range</li>
          <li>Team member receives email with their schedule</li>
        </ol>

        <p className="mb-2"><strong>Team Notifications:</strong></p>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click <strong>"Send Team Schedule Summary"</strong></li>
          <li>Select your team and date range</li>
          <li>All team members receive schedule summary</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Receiving Vacation Request Notifications</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>You'll receive notifications when team members submit vacation requests</li>
          <li>Desktop notifications (if enabled) alert you immediately</li>
          
        </ul>

        <h3 className="text-xl font-semibold mb-3">Desktop Notification Settings</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Go to <strong>Settings → Notifications</strong></li>
          <li>Enable desktop notifications</li>
          <li>Choose which events trigger notifications</li>
          <li>Save settings</li>
        </ol>
      </section>

      <Separator />

      <section id="vacation-planning">
        <h2 className="text-2xl font-bold mb-4">6.5 Vacation Planning Tools</h2>
        
        <p className="text-muted-foreground mb-4">
          The Vacation Planning Dashboard helps you make informed decisions about vacation requests 
          by providing visibility into team coverage and capacity.
        </p>

        <h3 className="text-xl font-semibold mb-3">Accessing Vacation Planning</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Vacation Planning</strong></li>
          <li>Select your team</li>
          <li>View the multi-month vacation calendar</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Coverage Heatmap</h3>
        <p className="mb-4">The heatmap shows team availability at a glance:</p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Green:</strong> Full team coverage</li>
          <li><strong>Yellow:</strong> Moderate coverage - some team members away</li>
          <li><strong>Orange:</strong> Low coverage - approaching minimums</li>
          <li><strong>Red:</strong> Critical - below minimum staffing</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Planning Features</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Capacity Overview:</strong> See pending requests and critical coverage days</li>
          <li><strong>Fairness Analysis:</strong> Monitor vacation day distribution across team</li>
          <li><strong>Conflict Detection:</strong> Identify overlapping requests and coverage gaps</li>
          <li><strong>Calendar View:</strong> See all approved and pending vacation in one place</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Using Insights for Decisions</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Check the heatmap before approving new requests</li>
          <li>Review fairness analysis to ensure equitable vacation distribution</li>
          <li>Use conflict detection to identify potential coverage issues</li>
          <li>Consider suggesting alternative dates if coverage is critical</li>
        </ol>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Strategic Planning</AlertTitle>
          <AlertDescription>
            Regular review of the vacation planning dashboard helps you balance team member 
            time-off needs with business coverage requirements.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="coverage-monitoring">
        <h2 className="text-2xl font-bold mb-4">7. Coverage Monitoring</h2>
        
        <p className="text-muted-foreground mb-4">
          Coverage monitoring tools help you identify and address staffing gaps to maintain 
          adequate team coverage.
        </p>

        <h3 className="text-xl font-semibold mb-3">Coverage Alerts</h3>
        <p className="mb-4">The system automatically highlights coverage concerns:</p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Critical Gaps:</strong> Days below minimum staffing requirements (red)</li>
          <li><strong>Warning Gaps:</strong> Days approaching minimum thresholds (yellow)</li>
          <li>Alerts appear on schedule views and dashboards</li>
          <li>Partnership coverage alerts for multi-team coordination</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Coverage Heatmap</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Coverage Analysis</strong></li>
          <li>Select team(s) and date range</li>
          <li>View color-coded coverage levels by day</li>
          <li>Identify patterns and recurring coverage issues</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Capacity Configuration</h3>
        <p className="mb-4">Set coverage requirements for your teams:</p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Minimum Staff Required:</strong> Minimum people needed per day</li>
          <li><strong>Maximum Staff Allowed:</strong> Optional cap to prevent over-scheduling</li>
          <li><strong>Weekend Settings:</strong> Different rules for weekends if needed</li>
          <li><strong>Partnership Settings:</strong> Combined minimums across partnership teams</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Using Coverage Insights</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Check coverage before approving vacation requests</li>
          <li>Identify periods needing additional scheduling</li>
          <li>Proactively address recurring coverage gaps</li>
          <li>Coordinate with partner teams to fill gaps</li>
        </ul>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Proactive Monitoring</AlertTitle>
          <AlertDescription>
            Review coverage alerts weekly to identify and address gaps before they become critical. 
            Early intervention prevents last-minute scrambling for coverage.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="holidays">
        <h2 className="text-2xl font-bold mb-4">9. Calendar & Holidays</h2>
        
        <h3 className="text-xl font-semibold mb-3">Viewing Team Holidays</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Holidays appear on the team calendar</li>
          <li>Country-specific holidays are assigned based on user profiles</li>
          <li>Holiday entries are marked distinctly on the schedule</li>
        </ul>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Holiday Management</AlertTitle>
          <AlertDescription>
            Managers cannot import or manage holidays. Contact your planner to add or modify 
            holiday calendars.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="delegation">
        <h2 className="text-2xl font-bold mb-4">10. Delegation</h2>
        
        <h3 className="text-xl font-semibold mb-3">Understanding Delegation</h3>
        <p className="mb-4">
          Planners can delegate schedule management to you temporarily. When this happens:
        </p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>You'll see a delegation banner showing the period and teams</li>
          <li>You'll receive a notification about the delegation</li>
          <li>You can manage schedules for delegated teams during the period</li>
          <li>Your delegation access expires automatically at the end date</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Managing Schedules During Delegation</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Access the delegated team from your team dropdown</li>
          <li>Manage schedules as you would for your own teams</li>
          <li>Approve vacation requests for delegated teams</li>
          <li>Send schedule notifications</li>
        </ol>
      </section>

      <Separator />

      <section id="export">
        <h2 className="text-2xl font-bold mb-4">11. Export & Reports</h2>
        
        <h3 className="text-xl font-semibold mb-3">Exporting Your Team's Schedule</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule</strong></li>
          <li>Select your team and date range</li>
          <li>Click <strong>"Export"</strong></li>
          <li>Choose format: Excel (.xlsx) or PDF</li>
          <li>Download and share with your team</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Team Capacity Reports</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>View team capacity metrics on your dashboard</li>
          <li>Export capacity reports for management review</li>
          <li>Monitor shift distribution fairness</li>
        </ol>
      </section>

      <Separator />

      <section id="best-practices">
        <h2 className="text-2xl font-bold mb-4">12. Best Practices</h2>
        
        <h3 className="text-xl font-semibold mb-3">Balancing Workload Fairly</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Monitor shift distribution to ensure fairness</li>
          <li>Rotate difficult shifts (nights, weekends) equitably</li>
          <li>Consider team members' preferences when possible</li>
          <li>Use the fairness analysis tool to identify imbalances</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Communicating Schedule Changes</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Always notify team members of schedule changes promptly</li>
          <li>Provide context for last-minute changes</li>
          <li>Use schedule notification features to keep team informed</li>
          <li>Maintain open communication channels</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Handling Urgent Vacation Requests</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Review team availability immediately</li>
          <li>Check if coverage is adequate</li>
          <li>Communicate decision quickly</li>
          <li>If rejecting, suggest alternative dates if possible</li>
        </ul>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Pro Tip</AlertTitle>
          <AlertDescription>
            Send 2-week schedule summaries regularly to keep your team informed and reduce 
            scheduling conflicts.
          </AlertDescription>
        </Alert>
      </section>
    </div>;
};