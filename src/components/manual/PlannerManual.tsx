import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
export const PlannerManual = () => {
  return <div className="space-y-8">
      <section id="getting-started">
        <h2 className="text-2xl font-bold mb-4">1. Getting Started</h2>
        <p className="text-muted-foreground mb-4">
          As a Planner, you have the highest level of access in the Employee Scheduler system. 
          You can manage users, teams, schedules, and access all analytics.
        </p>
        
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Your Role and Permissions</AlertTitle>
          <AlertDescription>
            Planners can create users, assign roles, manage all teams, approve vacation requests, 
            and access comprehensive analytics across the entire organization.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="user-management">
        <h2 className="text-2xl font-bold mb-4">2. User Management</h2>
        
        <h3 className="text-xl font-semibold mb-3">Creating New Users</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Dashboard → Admin Setup → User Management</strong></li>
          <li>Click <strong>"Create New User"</strong></li>
          <li>Enter the user's email address and name</li>
          <li>Select the appropriate role(s): Admin, Planner, Manager, or Team Member</li>
          <li>Click <strong>"Create User"</strong></li>
          <li>The system will generate a temporary password and send it to the user's email</li>
        </ol>

        <div className="my-4">
          
        </div>

        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>First-Time Login</AlertTitle>
          <AlertDescription>
            Users must change their temporary password on first login for security.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3">Bulk User Import</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Prepare a CSV file with columns: <code>email</code>, <code>role</code></li>
          <li>Navigate to <strong>Dashboard → Admin Setup → Bulk User Import</strong></li>
          <li>Upload your CSV file</li>
          <li>Review the preview and click <strong>"Import Users"</strong></li>
          <li>All users will receive temporary passwords via email</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Assigning and Managing Roles</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Admin:</strong> Full system access (equivalent to Planner)</li>
          <li><strong>Planner:</strong> Can manage users, teams, schedules, and view all analytics</li>
          <li><strong>Manager:</strong> Can manage assigned teams, approve vacation requests, assign Manager/Team Member roles</li>
          <li><strong>Team Member:</strong> Can view schedules, submit vacation requests, manage personal settings</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Editing User Profiles</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Go to <strong>User Management</strong></li>
          <li>Find the user and click the <strong>Edit</strong> icon</li>
          <li>Update email, roles, or other details</li>
          <li>Click <strong>"Update User"</strong></li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Resetting Passwords</h3>
        <p className="mb-2"><strong>Single User:</strong></p>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click the key icon next to the user</li>
          <li>Click <strong>"Set Temporary Password"</strong></li>
          <li>User will receive email with new temporary password</li>
        </ol>

        
        <ol className="list-decimal list-inside space-y-2 mb-4">
          
          
          
          
        </ol>

        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Deleting Users</AlertTitle>
          <AlertDescription>
            Deleting a user is permanent and removes all their schedule entries and data. 
            Use with caution.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="team-management">
        <h2 className="text-2xl font-bold mb-4">3. Team Management</h2>
        
        <h3 className="text-xl font-semibold mb-3">Creating Teams</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Team Management</strong></li>
          <li>Click <strong>"Create New Team"</strong></li>
          <li>Enter team name and description</li>
          <li>Click <strong>"Create Team"</strong></li>
        </ol>

        <div className="my-4">
          
        </div>

        <h3 className="text-xl font-semibold mb-3">Adding Team Members</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Select a team from the dropdown</li>
          <li>Click <strong>"Add Member"</strong></li>
          <li>Select user(s) from the available list</li>
          <li>Optionally assign as team manager by checking the manager checkbox</li>
          <li>Click <strong>"Add to Team"</strong></li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Configuring Team Capacity</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Go to <strong>Team Capacity Configuration</strong></li>
          <li>Set maximum shifts per week/month for the team</li>
          <li>Configure shift type limits (day/evening/night)</li>
          <li>Set minimum rest periods between shifts</li>
          <li>Click <strong>"Save Configuration"</strong></li>
        </ol>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Team Managers</AlertTitle>
          <AlertDescription>
            Users marked as team managers can manage schedules and approve vacation requests 
            for their assigned teams only.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="schedule-management">
        <h2 className="text-2xl font-bold mb-4">4. Schedule Management</h2>
        
        <h3 className="text-xl font-semibold mb-3">Creating Schedule Entries</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule</strong></li>
          <li>Select a team from the dropdown</li>
          <li>Click on a date in the calendar or use <strong>"Add Schedule Entry"</strong></li>
          <li>Select the user</li>
          <li>Choose date and time block:
            <ul className="list-disc list-inside ml-6 mt-2">
              <li><strong>Day:</strong> 06:00 - 14:00</li>
              <li><strong>Evening:</strong> 14:00 - 22:00</li>
              <li><strong>Night:</strong> 22:00 - 06:00</li>
            </ul>
          </li>
          <li>Select shift type: Working, Vacation, Sick, Training, or Other</li>
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
            <li>Search functionality to find specific team members</li>
          </ul>
        </div>

        <div className="bg-accent/20 border border-accent/40 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-2">Step 3: Date Range</h4>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li>Select start and end dates using visual calendar</li>
            <li>Quick select buttons: "This Week", "Next 2 Weeks", "This Month"</li>
            <li>Toggle options:</li>
            <ul className="list-disc list-inside ml-6 space-y-1">
              <li>☑ Skip Weekends (exclude Saturday & Sunday)</li>
              <li>☑ Skip Public Holidays (auto-detected based on country/region)</li>
            </ul>
          </ul>
        </div>

        <div className="bg-accent/20 border border-accent/40 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-2">Step 4: Shift Configuration</h4>
          <p className="text-sm mb-2">Choose from preset shift times or create custom:</p>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li><strong>Standard Day:</strong> 8:00-16:30</li>
            <li><strong>Early Shift:</strong> 6:00-14:00</li>
            <li><strong>Late Shift:</strong> 14:00-22:00</li>
            <li><strong>Night Shift:</strong> 22:00-06:00</li>
            <li><strong>Weekend Duty:</strong> Configurable weekend coverage</li>
            <li><strong>Custom Times:</strong> Set your own start/end times</li>
          </ul>
          <p className="text-sm mt-2 text-muted-foreground">View duration and midnight crossing warnings automatically.</p>
        </div>

        <div className="bg-accent/20 border border-accent/40 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-2">Step 5: Advanced Options (Optional)</h4>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li><strong>Fairness Distribution:</strong> Balance shifts fairly across team members</li>
            <li><strong>Recurring Rotation Patterns (Rotation Mode Only):</strong></li>
            <ul className="list-disc list-inside ml-6 space-y-1">
              <li>Enable recurring rotation to repeat your schedule pattern</li>
              <li><strong>Rotation Interval:</strong> Choose how often to repeat (1-12 weeks)</li>
              <li><strong>Number of Cycles:</strong> Set how many times to repeat (1-26 cycles)</li>
              <li>Example: Schedule 1 week, repeat every 4 weeks for 13 cycles = 1 year of coverage</li>
              <li>System automatically calculates total duration in weeks and months</li>
            </ul>
            <li><strong>Priority Weights:</strong> Adjust importance of night/weekend/holiday shifts</li>
          </ul>
        </div>

        <div className="bg-accent/20 border border-accent/40 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-2">Step 6: Review & Generate</h4>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li>Review all selections in comprehensive summary</li>
            <li>See total shift count before generation (accounts for rotation cycles)</li>
            <li>For recurring rotations, view additional info:</li>
            <ul className="list-disc list-inside ml-6 space-y-1">
              <li>Rotation interval and number of cycles</li>
              <li>Total duration across all cycles</li>
              <li>Automatic calculation of shifts × cycles</li>
            </ul>
            <li>Preview calendar showing first 14 days with:</li>
            <ul className="list-disc list-inside ml-6 space-y-1">
              <li>User initials/team indicators on each day</li>
              <li>Shift type badges (Day, Night, Early, Late)</li>
              <li>Hover tooltips with full schedule details</li>
              <li>Visual distinction between weekdays and weekends</li>
            </ul>
            <li>Click <strong>"Generate Schedule"</strong> to create all entries across all cycles</li>
          </ul>
        </div>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Navigation Tips</AlertTitle>
          <AlertDescription>
            The wizard shows your progress at the top with completed steps marked. Use "Back" to change previous selections or "Cancel" to exit without saving.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3">Editing Schedules</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click on any schedule entry in the calendar</li>
          <li>Modify date, time block, shift type, or notes</li>
          <li>Click <strong>"Update"</strong></li>
          <li>Optionally send notification to affected user</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Bulk Edit Shifts</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click <strong>"Bulk Edit"</strong></li>
          <li>Select date range and users</li>
          <li>Choose the modification: change shift type, time block, or delete</li>
          <li>Apply changes</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Unified Team Scheduler - Navigation Tips</h3>
        <p className="mb-4">
          When viewing schedules with many days (more than 14), the scheduler enables horizontal scrolling:
        </p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Mouse Wheel Scrolling:</strong> Use your mouse wheel to scroll horizontally across dates</li>
          <li><strong>Trackpad Gestures:</strong> Swipe horizontally with two fingers on trackpad</li>
          <li><strong>Drag to Scroll:</strong> Click and drag the grid content to navigate</li>
          <li><strong>Scrollbar:</strong> Use the horizontal scrollbar at the bottom</li>
          <li><strong>Shift + Mouse Wheel:</strong> Hold Shift while scrolling to move vertically</li>
        </ul>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Wide Schedule View</AlertTitle>
          <AlertDescription>
            The scheduler automatically adjusts column widths based on the number of days displayed. 
            For 14 or fewer days, columns expand to fill the screen. For more days, columns are 
            fixed at 80px to enable smooth horizontal scrolling.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3 mt-6">Rotation Templates</h3>
        <p className="mb-4">
          Rotation templates allow you to save common scheduling patterns and reuse them across teams and dates.
        </p>

        <h4 className="font-semibold mb-2">Accessing Templates</h4>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Dashboard → Admin Setup</strong></li>
          <li>Click the <strong>"Templates"</strong> tab</li>
          <li>View your templates and public templates created by others</li>
        </ol>

        <h4 className="font-semibold mb-2">Creating a New Template</h4>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>In the Templates tab, click <strong>"Create New Template"</strong></li>
          <li>Enter a template name and description</li>
          <li>Select which teams can use this template</li>
          <li>Choose the pattern type:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li><strong>Fixed Days:</strong> Specific dates get assigned shifts</li>
              <li><strong>Repeating Sequence:</strong> Pattern repeats in order (e.g., Day, Night, Day, Off)</li>
              <li><strong>Weekly Pattern:</strong> Different shifts for each day of the week</li>
              <li><strong>Custom Pattern:</strong> Define your own complex rotation</li>
            </ul>
          </li>
          <li>Configure the pattern details (days, shift types, time blocks)</li>
          <li>Toggle <strong>"Make Public"</strong> if you want all teams to access this template</li>
          <li>Click <strong>"Save Template"</strong></li>
        </ol>

        <h4 className="font-semibold mb-2">Applying Templates to Schedules</h4>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Go to <strong>Schedule</strong> view</li>
          <li>Select team members (use checkboxes on the left)</li>
          <li>Click <strong>"Apply Template"</strong> in the quick actions toolbar</li>
          <li>Choose a template from the list</li>
          <li>Select the date range to apply the template</li>
          <li>Review the preview and click <strong>"Apply"</strong></li>
        </ol>

        <h4 className="font-semibold mb-2">Editing and Deleting Templates</h4>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Edit:</strong> Click the edit icon next to your template, modify settings, and save</li>
          <li><strong>Delete:</strong> Click the delete icon and confirm removal</li>
          <li><strong>Note:</strong> You can only edit/delete templates you created</li>
          <li><strong>Public Templates:</strong> Visible to everyone but can only be modified by the creator</li>
        </ul>

        <Alert className="mb-4">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Template Best Practices</AlertTitle>
          <AlertDescription>
            Create templates for commonly used rotation patterns (e.g., "2 weeks on-call rotation", 
            "Weekend coverage cycle"). Make them public if other planners should use them, or keep 
            them private for team-specific patterns.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3 mt-6">Shift Swap Requests</h3>
        <p className="mb-4">
          Team members can request to swap shifts with their colleagues. As a Planner, you can monitor 
          and manage these swap requests to ensure proper coverage.
        </p>

        <h4 className="font-semibold mb-2">Viewing Swap Requests</h4>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Shift Swaps</strong></li>
          <li>See all pending, approved, and rejected swap requests</li>
          <li>Filter by team, date range, or status</li>
          <li>Review request details: who's swapping with whom, which shifts, dates</li>
        </ol>

        <h4 className="font-semibold mb-2">Approving or Rejecting Swaps</h4>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click on a pending swap request</li>
          <li>Review the swap details:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>Requesting user and target user</li>
              <li>Shift date and type being swapped</li>
              <li>Any notes or reasons provided</li>
            </ul>
          </li>
          <li>Verify that both users can work the swapped shifts</li>
          <li>Check team coverage won't be impacted</li>
          <li>Click <strong>"Approve"</strong> or <strong>"Reject"</strong></li>
          <li>Add optional notes explaining your decision</li>
        </ol>

        <h4 className="font-semibold mb-2">What Happens When Approved</h4>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Schedule entries are automatically swapped between the two users</li>
          <li>Both users receive notification of approval</li>
          <li>Calendar updates immediately to reflect the swap</li>
          <li>Swap is logged in the system for audit purposes</li>
        </ul>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Swap Validation</AlertTitle>
          <AlertDescription>
            Before approving swaps, verify that both team members are qualified for the swapped 
            shifts and that team coverage requirements are maintained. Consider any training, 
            certification, or seniority requirements.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="vacation-requests">
        <h2 className="text-2xl font-bold mb-4">5. Vacation Request Management</h2>
        
        <h3 className="text-xl font-semibold mb-3">Viewing Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Vacation Requests</strong></li>
          <li>View all pending requests across all teams</li>
          <li>Filter by team, user, or date range</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Approving Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Review the request details (dates, duration, notes)</li>
          <li>Check team availability and coverage</li>
          <li>Click <strong>"Approve"</strong></li>
          <li>The system automatically creates vacation schedule entries</li>
          <li>User receives approval notification</li>
        </ol>

        <div className="my-4">
          
        </div>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Planner-Only Action</AlertTitle>
          <AlertDescription>
            Only Planners and Admins can approve or reject vacation requests. Managers can 
            view requests but must contact you to have them processed.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3">Rejecting Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click <strong>"Reject"</strong> on the request</li>
          <li>Provide a reason for rejection (required)</li>
          <li>User receives rejection notification with reason</li>
        </ol>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Multi-Day Requests</AlertTitle>
          <AlertDescription>
            Multi-day vacation requests automatically exclude weekends when calculating working days.
            Approval creates vacation entries for each working day in the range.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="holidays">
        <h2 className="text-2xl font-bold mb-4">6. Calendar & Holiday Management</h2>
        
        <h3 className="text-xl font-semibold mb-3">Importing Holidays from CSV</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Holiday Manager</strong></li>
          <li>Prepare CSV with columns: <code>name</code>, <code>date</code>, <code>country</code></li>
          <li>Click <strong>"Import Holidays"</strong></li>
          <li>Upload your CSV file</li>
          <li>Review and confirm import</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Auto-Assign Holidays by Country</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Ensure users have their country set in their profile</li>
          <li>Click <strong>"Auto-Assign Holidays"</strong></li>
          <li>System automatically creates holiday schedule entries for users based on their country</li>
        </ol>
      </section>

      <Separator />

      <section id="delegation">
        <h2 className="text-2xl font-bold mb-4">7. Delegation & Access Control</h2>
        
        <h3 className="text-xl font-semibold mb-3">Delegating Schedule Management</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Delegate Access</strong></li>
          <li>Select the manager to delegate to</li>
          <li>Choose the team(s) to delegate</li>
          <li>Set start and end dates for delegation period</li>
          <li>Click <strong>"Delegate Access"</strong></li>
          <li>Manager receives notification and can manage the team's schedule during this period</li>
        </ol>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Delegation Indicator</AlertTitle>
          <AlertDescription>
            When viewing a delegated team's schedule, you'll see a banner indicating the delegation period and manager.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="analytics">
        <h2 className="text-2xl font-bold mb-4">8. Analytics Dashboard</h2>
        
        <h3 className="text-xl font-semibold mb-3">Accessing Analytics</h3>
        <p className="mb-4">Navigate to <strong>Dashboard → Analytics</strong> to view comprehensive metrics.</p>

        <h3 className="text-xl font-semibold mb-3">Metrics Overview</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Capacity Utilization:</strong> Current usage vs. available capacity</li>
          <li><strong>Utilization Rate:</strong> Percentage of total capacity being used</li>
          <li><strong>Capacity Trend:</strong> Historical capacity usage over time</li>
          <li><strong>Upcoming Capacity:</strong> Forecasted capacity for next 30 days</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Workforce Analytics</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Shift Distribution:</strong> Breakdown of day/evening/night shifts by team</li>
          <li><strong>Fairness Analysis:</strong> Identifies imbalances in shift distribution</li>
          <li><strong>Leave Patterns:</strong> Vacation and sick leave trends</li>
          <li><strong>Individual Workload:</strong> Shift counts per employee</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Operational Insights</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Coverage Gaps:</strong> Dates with insufficient staffing</li>
          <li><strong>Peak Hours:</strong> Times with highest/lowest coverage</li>
          <li><strong>Request Patterns:</strong> Vacation request trends and approval rates</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Filtering and Exporting</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Use filters to select specific teams and date ranges</li>
          <li>Click <strong>"Export"</strong> to download analytics data (Excel/PDF)</li>
          <li>Share reports with management</li>
        </ol>
      </section>

      <Separator />

      <section id="notifications">
        <h2 className="text-2xl font-bold mb-4">9. Notifications & Communications</h2>
        
        <h3 className="text-xl font-semibold mb-3">Sending Schedule Summaries</h3>
        <p className="mb-2"><strong>Individual Notifications:</strong></p>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule</strong></li>
          <li>Click <strong>"Send 2-Week Schedule"</strong></li>
          <li>Select user and date range</li>
          <li>User receives email with their schedule</li>
        </ol>

        <p className="mb-2"><strong>Team Notifications:</strong></p>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click <strong>"Send Team Schedule Summary"</strong></li>
          <li>Select team and date range</li>
          <li>All team members receive schedule summary</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Desktop Notifications</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Go to <strong>Settings → Notifications</strong></li>
          <li>Enable desktop notifications</li>
          <li>Choose which events trigger notifications</li>
          <li>Save settings</li>
        </ol>
      </section>

      <Separator />

      <section id="integrations">
        <h2 className="text-2xl font-bold mb-4">10. Integrations</h2>
        
        <h3 className="text-xl font-semibold mb-3">Microsoft Outlook Integration</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Settings → Integrations</strong></li>
          <li>Click <strong>"Connect Outlook"</strong></li>
          <li>Sign in with your Microsoft account</li>
          <li>Grant calendar permissions</li>
          <li>Schedule entries will sync to Outlook automatically</li>
        </ol>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>OAuth Tokens</AlertTitle>
          <AlertDescription>
            Outlook tokens are managed automatically. If sync issues occur, disconnect and reconnect the integration.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="export">
        <h2 className="text-2xl font-bold mb-4">11. Export & Reporting</h2>
        
        <h3 className="text-xl font-semibold mb-3">Exporting Schedules</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule</strong></li>
          <li>Select team and date range</li>
          <li>Click <strong>"Export"</strong></li>
          <li>Choose format: Excel (.xlsx) or PDF</li>
          <li>Download file</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Team Capacity Reports</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Go to <strong>Analytics</strong></li>
          <li>Filter by team and date range</li>
          <li>Export capacity utilization and fairness reports</li>
        </ol>
      </section>

      <Separator />

      <section id="security">
        <h2 className="text-2xl font-bold mb-4">16. Security & Best Practices</h2>
        
        <h3 className="text-xl font-semibold mb-3">Password Policies</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Temporary passwords expire after first use</li>
          <li>Users must change temporary passwords on first login</li>
          <li>Passwords must meet minimum security requirements</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Role-Based Access Control</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Assign minimum necessary permissions to users</li>
          <li>Regularly review user roles and access levels</li>
          <li>Remove roles when users change positions</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Data Privacy</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>All data is protected by Row-Level Security (RLS) policies</li>
          <li>Users can only access data for their assigned teams</li>
          <li>Schedule data is encrypted at rest and in transit</li>
        </ul>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Best Practice</AlertTitle>
          <AlertDescription>
            Regularly audit user access and remove inactive users to maintain security.
          </AlertDescription>
        </Alert>
      </section>
    </div>;
};