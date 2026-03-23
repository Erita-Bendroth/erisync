

## Add Team Member Search to Teams Tab

### What
Add a search input to the Team Management UI so users can filter team members by name, initials, or email across all teams.

### Implementation

**File: `src/components/schedule/EnhancedTeamManagement.tsx`**

1. **Add state** (around line 103):
   ```typescript
   const [memberSearchQuery, setMemberSearchQuery] = useState("");
   ```

2. **Add search input** in the UI header area (around line 920, after the CardDescription):
   - Add an `Input` with a search icon, placeholder "Search members...", bound to `memberSearchQuery`
   - Place it in the header row alongside existing buttons

3. **Filter members per team** in the render loop where team cards are displayed:
   - For each team, filter `teamMembers[team.id]` by checking if the search query matches `first_name`, `last_name`, `initials`, or `email` (case-insensitive)
   - If a team has zero matching members and search is active, hide that team card entirely
   - If search is empty, show all members as before

### Files
| File | Change |
|------|--------|
| `src/components/schedule/EnhancedTeamManagement.tsx` | Add search state, search input, and member filtering logic |

