import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

export const ManagerManual = () => {
  return (
    <div className="space-y-8">
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
          <li><strong>Pending Vacation Requests:</strong> Requests awaiting your approval</li>
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

        <div className="bg-muted p-4 rounded-lg mb-4 border-l-4 border-primary">
          <p className="text-sm font-medium mb-2">📸 Screenshot would show:</p>
          <p className="text-sm text-muted-foreground">
            The "Add Entry" button in the schedule interface, showing the form with 
            dropdowns for team member selection, date picker, time block radio buttons 
            (Day/Evening/Night), and shift type dropdown (Working/Vacation/Sick/Training/Other).
          </p>
        </div>

        <h3 className="text-xl font-semibold mb-3">Editing Schedule Entries</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click on any schedule entry in the calendar</li>
          <li>Modify date, time block, shift type, or notes</li>
          <li>Click <strong>"Update"</strong></li>
          <li>Consider notifying the affected team member of changes</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Understanding Shift Types</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Working:</strong> Regular work shift</li>
          <li><strong>Vacation:</strong> Approved time off</li>
          <li><strong>Sick:</strong> Sick leave</li>
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

      <section id="vacation-requests">
        <h2 className="text-2xl font-bold mb-4">5. Vacation Requests</h2>
        
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important: Managers Cannot Approve Vacation Requests</AlertTitle>
          <AlertDescription>
            Only Planners and Admins have the authority to approve or reject vacation requests. 
            As a Manager, you can view requests from your team members, but you must contact 
            a Planner to have them approved or rejected.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3">Viewing Your Team's Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → Vacation Requests</strong></li>
          <li>View pending requests from your team members</li>
          <li>See request details: dates, duration, notes</li>
          <li>Check team availability for the requested dates</li>
        </ol>

        <div className="bg-muted p-4 rounded-lg mb-4 border-l-4 border-primary">
          <p className="text-sm font-medium mb-2">📸 Screenshot would show:</p>
          <p className="text-sm text-muted-foreground">
            The Vacation Requests list showing team member names, requested dates, 
            status badges (pending/approved/rejected), and the ability to view details 
            but no approve/reject buttons for managers.
          </p>
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
          <li>Contact your Planner or Admin via the app or email</li>
          <li>Provide context: coverage status, business needs, urgency</li>
          <li>The Planner will make the final decision and notify the team member</li>
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
        <h2 className="text-2xl font-bold mb-4">6. Role Management</h2>
        
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
        <h2 className="text-2xl font-bold mb-4">7. Notifications</h2>
        
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
          <li>Email notifications provide request details</li>
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

      <section id="holidays">
        <h2 className="text-2xl font-bold mb-4">8. Calendar & Holidays</h2>
        
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
        <h2 className="text-2xl font-bold mb-4">9. Delegation</h2>
        
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
        <h2 className="text-2xl font-bold mb-4">10. Export & Reports</h2>
        
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
        <h2 className="text-2xl font-bold mb-4">11. Best Practices</h2>
        
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
    </div>
  );
};
