import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
export const TeamMemberManual = () => {
  return <div className="space-y-8">
      <section id="getting-started">
        <h2 className="text-2xl font-bold mb-4">1. Getting Started</h2>
        <p className="text-muted-foreground mb-4">
          Welcome to the Employee Scheduler! As a Team Member, you can view your schedule, 
          request time off, and manage your personal settings. This guide will help you get the most 
          out of the system.
        </p>
        
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Your Access</AlertTitle>
          <AlertDescription>
            Team Members can view team schedules, submit vacation requests, and manage personal 
            settings. You can see your teammates' schedules to coordinate and plan better.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="viewing-schedule">
        <h2 className="text-2xl font-bold mb-4">2. Viewing Your Schedule</h2>
        
        <h3 className="text-xl font-semibold mb-3">Navigating to Your Schedule</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Log in to the Employee Scheduler</li>
          <li>Click <strong>Schedule</strong> in the top navigation bar</li>
          <li>Your team's schedule will be displayed</li>
        </ol>

        <div className="my-4">
          
        </div>

        <h3 className="text-xl font-semibold mb-3">Calendar Views</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Daily View:</strong> See today's schedule for all team members</li>
          <li><strong>Weekly View:</strong> View the entire week at a glance</li>
          <li><strong>Monthly View:</strong> Get an overview of the whole month</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Understanding Shift Types</h3>
        <p className="mb-2"><strong>Time Blocks:</strong></p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Day:</strong> 06:00 - 14:00</li>
          <li><strong>Evening:</strong> 14:00 - 22:00</li>
          <li><strong>Night:</strong> 22:00 - 06:00</li>
        </ul>

        <p className="mb-2"><strong>Activity Types:</strong></p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Working:</strong> Regular work shift (usually shown in blue)</li>
          <li><strong>Vacation:</strong> Approved time off (usually shown in green)</li>
          <li><strong>Sick:</strong> Sick leave (usually shown in red)</li>
          <li><strong>Training:</strong> Training or development activities (usually shown in purple)</li>
          <li><strong>Other:</strong> Other scheduled activities (usually shown in gray)</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Bookmarking Schedule Dates</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click on any date in the calendar</li>
          <li>Click the bookmark icon</li>
          <li>Access your bookmarked dates from the <strong>Bookmarks</strong> menu</li>
          <li>Quickly jump to important dates</li>
        </ol>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Color Coding</AlertTitle>
          <AlertDescription>
            Different shift types use different colors for easy identification. Your shifts 
            may be highlighted or emphasized differently from your teammates'.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="requesting-time-off">
        <h2 className="text-2xl font-bold mb-4">3. Requesting Time Off</h2>
        
        <h3 className="text-xl font-semibold mb-3">How to Submit a Vacation Request</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule</strong></li>
          <li>Click <strong>"Request Vacation"</strong> button</li>
          <li>Fill out the vacation request form:
            <ul className="list-disc list-inside ml-6 mt-2">
              <li><strong>Start Date:</strong> First day of vacation</li>
              <li><strong>End Date:</strong> Last day of vacation</li>
              <li><strong>Full Day:</strong> Check if taking full days off</li>
              <li><strong>Planner:</strong> Select which planner/admin to send the request to</li>
              <li><strong>Notes:</strong> Add any context or special circumstances</li>
            </ul>
          </li>
          <li>Click <strong>"Submit Request"</strong></li>
          <li>You'll receive a confirmation and the planner will be notified</li>
        </ol>

        <div className="my-4">
          
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Who Approves Requests?</AlertTitle>
          <AlertDescription>
            Only Planners and Admins can approve vacation requests. Your manager can view 
            your request but cannot approve it - a Planner will review and make the decision.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3">Single Day vs. Multi-Day Requests</h3>
        <p className="mb-2"><strong>Single Day:</strong></p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Select the same date for start and end</li>
          <li>Can choose full day or partial day (specify time block)</li>
        </ul>

        <p className="mb-2"><strong>Multi-Day:</strong></p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Select different start and end dates</li>
          <li>System automatically calculates working days (excludes weekends)</li>
          <li>Creates vacation entries for each working day in the range</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Choosing Which Planner to Send To</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Select from available planners/admins in the dropdown</li>
          <li>Choose the planner who typically manages your team's schedule</li>
          <li>If unsure, ask your manager which planner to select</li>
        </ul>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Working Days Calculation</AlertTitle>
          <AlertDescription>
            Multi-day vacation requests automatically exclude weekends. Only Monday-Friday 
            are counted as working days unless your organization has different work weeks.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="managing-requests">
        <h2 className="text-2xl font-bold mb-4">4. Managing Your Requests</h2>
        
        <h3 className="text-xl font-semibold mb-3">Viewing Your Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule → My Vacation Requests</strong></li>
          <li>See all your vacation requests with statuses:
            <ul className="list-disc list-inside ml-6 mt-2">
              <li><strong>Pending:</strong> Waiting for manager approval (yellow)</li>
              <li><strong>Approved:</strong> Manager has approved (green)</li>
              <li><strong>Rejected:</strong> Manager has rejected (red)</li>
            </ul>
          </li>
          <li>View dates, duration, and notes for each request</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Editing Pending Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Find the pending request in your list</li>
          <li>Click <strong>"Edit"</strong></li>
          <li>Modify dates, notes, or other details</li>
          <li>Click <strong>"Update Request"</strong></li>
          <li>Manager receives notification of updated request</li>
        </ol>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Editing Restrictions</AlertTitle>
          <AlertDescription>
            You can only edit requests that are still pending. Approved or rejected requests 
            cannot be edited. Submit a new request if needed.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3">Canceling Pending Requests</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Find the pending request</li>
          <li>Click <strong>"Cancel"</strong></li>
          <li>Confirm cancellation</li>
          <li>Request is removed from pending list</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Understanding Rejection Reasons</h3>
        <p className="mb-4">
          If your request is rejected, your manager will provide a reason. Common reasons include:
        </p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Insufficient coverage for the requested period</li>
          <li>Too many team members already on vacation</li>
          <li>High-demand period requiring full staffing</li>
          <li>Request submitted too late (didn't allow enough notice)</li>
        </ul>

        <p className="mb-4">
          <strong>What to do if rejected:</strong>
        </p>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Read the rejection reason carefully</li>
          <li>Consider alternative dates</li>
          <li>Discuss with your manager if you have questions</li>
          <li>Submit a new request for different dates</li>
        </ol>
      </section>

      <Separator />

      <section id="team-availability">
        <h2 className="text-2xl font-bold mb-4">5. Team Availability</h2>
        
        <h3 className="text-xl font-semibold mb-3">Viewing Your Team's Schedule</h3>
        <p className="mb-4">
          You can view your teammates' schedules to coordinate and plan better:
        </p>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Schedule</strong></li>
          <li>Select your team from the dropdown (if you're on multiple teams)</li>
          <li>View the full team calendar</li>
          <li>See who's working, on vacation, or out sick</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Checking Who's Available</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Use the team availability view to see real-time availability</li>
          <li>Check before requesting vacation to see team coverage</li>
          <li>Coordinate with teammates for shift swaps (contact your manager)</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Understanding Coverage Needs</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>If many teammates are already on vacation, your request may be delayed</li>
          <li>Plan vacation requests early for popular periods</li>
          <li>Consider team coverage when selecting dates</li>
        </ul>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Pro Tip</AlertTitle>
          <AlertDescription>
            Check team availability before submitting vacation requests. If many teammates 
            are already scheduled off, consider alternative dates.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="notifications">
        <h2 className="text-2xl font-bold mb-4">6. Notifications</h2>
        
        <h3 className="text-xl font-semibold mb-3">Receiving Schedule Notifications</h3>
        <p className="mb-4">You'll receive notifications for:</p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li><strong>Schedule Changes:</strong> When your schedule is modified</li>
          <li><strong>New Schedule Entries:</strong> When shifts are assigned to you</li>
          <li><strong>2-Week Schedule Summaries:</strong> Periodic overview of your upcoming schedule</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Vacation Request Updates</h3>
        <p className="mb-4">You'll be notified when:</p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Your manager receives your vacation request</li>
          <li>Your request is approved (includes confirmation details)</li>
          <li>Your request is rejected (includes rejection reason)</li>
        </ul>

        <h3 className="text-xl font-semibold mb-3">Enabling Desktop Notifications</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Settings → Notifications</strong></li>
          <li>Click <strong>"Enable Desktop Notifications"</strong></li>
          <li>Allow browser permissions when prompted</li>
          <li>Choose which events trigger notifications</li>
          <li>Save your preferences</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Email Summaries</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Receive regular email summaries of your schedule</li>
          <li>2-week lookahead schedules sent periodically</li>
          <li>Important changes are highlighted in emails</li>
        </ul>
      </section>

      <Separator />

      <section id="user-settings">
        <h2 className="text-2xl font-bold mb-4">7. User Settings</h2>
        
        <h3 className="text-xl font-semibold mb-3">Updating Your Profile</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click your email address in the top right</li>
          <li>Select <strong>Profile Settings</strong></li>
          <li>Update your information:
            <ul className="list-disc list-inside ml-6 mt-2">
              <li>Name</li>
              <li>Email address</li>
              <li>Country (for holiday assignment)</li>
              <li>Contact information</li>
            </ul>
          </li>
          <li>Click <strong>"Save Changes"</strong></li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Changing Your Password</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Go to <strong>Settings → Password</strong></li>
          <li>Enter your current password</li>
          <li>Enter your new password (must meet security requirements)</li>
          <li>Confirm new password</li>
          <li>Click <strong>"Change Password"</strong></li>
        </ol>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Password Requirements</AlertTitle>
          <AlertDescription>
            Passwords must be at least 8 characters long and include a mix of letters, 
            numbers, and special characters for security.
          </AlertDescription>
        </Alert>

        <h3 className="text-xl font-semibold mb-3">Setting Your Country</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Go to <strong>Profile Settings</strong></li>
          <li>Select your country from the dropdown</li>
          <li>Save changes</li>
          <li>Country-specific holidays will be automatically assigned to your schedule</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Notification Preferences</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Settings → Notifications</strong></li>
          <li>Toggle notification types:
            <ul className="list-disc list-inside ml-6 mt-2">
              <li>Schedule change notifications</li>
              <li>Vacation request updates</li>
              <li>Email summaries</li>
              <li>Desktop notifications</li>
            </ul>
          </li>
          <li>Save your preferences</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Theme Settings</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click the theme toggle icon in the header</li>
          <li>Choose between:
            <ul className="list-disc list-inside ml-6 mt-2">
              <li><strong>Light Mode:</strong> Bright background, dark text</li>
              <li><strong>Dark Mode:</strong> Dark background, light text</li>
              <li><strong>System:</strong> Follows your device's theme preference</li>
            </ul>
          </li>
          <li>Theme changes immediately</li>
        </ol>
      </section>

      <Separator />

      <section id="outlook-integration">
        <h2 className="text-2xl font-bold mb-4">8. Outlook Integration (if available)</h2>
        
        <h3 className="text-xl font-semibold mb-3">Connecting Your Outlook Calendar</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Navigate to <strong>Settings → Integrations</strong></li>
          <li>Click <strong>"Connect Outlook"</strong></li>
          <li>Sign in with your Microsoft account</li>
          <li>Grant calendar permissions</li>
          <li>Your schedule will sync to Outlook automatically</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Managing Calendar Permissions</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Schedule entries appear in your Outlook calendar</li>
          <li>Changes in the Employee Scheduler sync to Outlook</li>
          <li>You can disconnect the integration at any time</li>
        </ul>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Sync Benefits</AlertTitle>
          <AlertDescription>
            Outlook integration keeps your work schedule and personal calendar in sync, 
            preventing conflicts and making planning easier.
          </AlertDescription>
        </Alert>
      </section>

      <Separator />

      <section id="global-search">
        <h2 className="text-2xl font-bold mb-4">9. Global Search</h2>
        
        <h3 className="text-xl font-semibold mb-3">Searching for Team Members</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Click the search icon in the header</li>
          <li>Type a team member's name or email</li>
          <li>Select from search results</li>
          <li>View their schedule and availability</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Searching Schedule Entries</h3>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>Use the search bar to find specific dates or shift types</li>
          <li>Search by date range</li>
          <li>Filter by shift type (working, vacation, etc.)</li>
          <li>Quickly find relevant schedule entries</li>
        </ol>

        <h3 className="text-xl font-semibold mb-3">Quick Navigation Tips</h3>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Use keyboard shortcuts for faster navigation (if available)</li>
          <li>Bookmark frequently accessed dates</li>
          <li>Use the calendar navigation to jump to specific months</li>
        </ul>
      </section>

      <Separator />

      <section id="faqs">
        <h2 className="text-2xl font-bold mb-4">10. FAQs</h2>
        
        <h3 className="text-xl font-semibold mb-3">What if my vacation request is rejected?</h3>
        <p className="mb-4">
          Read the rejection reason provided by the planner. Consider alternative dates or 
          discuss the situation with your manager or the planner directly. You can submit 
          a new request for different dates.
        </p>

        <h3 className="text-xl font-semibold mb-3">Can I see other team members' schedules?</h3>
        <p className="mb-4">
          Yes! You can view your entire team's schedule to coordinate and plan better. 
          This helps with collaboration and understanding team availability.
        </p>

        <h3 className="text-xl font-semibold mb-3">How do I report schedule conflicts?</h3>
        <p className="mb-4">
          If you notice a conflict in your schedule (e.g., double-booked shifts), contact 
          your manager immediately via the contact form or your organization's communication 
          channels. Provide specific details about the conflict.
        </p>

        <h3 className="text-xl font-semibold mb-3">Who do I contact for access issues?</h3>
        <p className="mb-4">
          If you're having trouble logging in or accessing certain features, contact your 
          manager or system administrator. For password reset issues, use the "Forgot Password" 
          link on the login page.
        </p>

        <h3 className="text-xl font-semibold mb-3">Can I swap shifts with a coworker?</h3>
        <p className="mb-4">
          Shift swaps must be approved by your manager. Coordinate with your coworker first, 
          then contact your manager to request the swap. Your manager will update the schedule 
          if approved.
        </p>

        <h3 className="text-xl font-semibold mb-3">How far in advance should I request vacation?</h3>
        <p className="mb-4">
          The earlier, the better! Advance notice allows your manager to plan coverage. 
          Check your organization's policies for specific requirements, but 2-4 weeks notice 
          is generally recommended for non-emergency requests.
        </p>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Need More Help?</AlertTitle>
          <AlertDescription>
            Contact your manager or use the Contact form in the app if you have questions 
            not covered in this manual.
          </AlertDescription>
        </Alert>
      </section>
    </div>;
};