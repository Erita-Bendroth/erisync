## What I will change

You are right: **Turbine Troubleshooting Offshore should not be added inside Troubleshooting Central**. It should be its own selectable partnership/team in the same **Team Scheduler → Partnership → Partnership Settings** configuration area shown in your screenshot.

## Implementation plan

1. **Create/use its own partnership**
   - Check whether a `Turbine Troubleshooting Offshore` planning partnership already exists.
   - If it does not exist, add one in `team_planning_partners` with only the existing `Turbine Troubleshooting Offshore` team.
   - This will make it appear in the **Partnership** dropdown in Team Scheduler, separate from `Troubleshooting Central`.

2. **Make offshore automatic for that partnership**
   - Detect partnerships whose team name contains `Offshore`.
   - Show the **Offshore** badge automatically for `Turbine Troubleshooting Offshore`.
   - Treat offshore mode as enabled by default for that partnership, instead of requiring you to manually switch it on.

3. **Add it to the exact configuration dialog in the screenshot**
   - When `Turbine Troubleshooting Offshore` is selected from the Partnership dropdown and the settings gear is opened, the same dialog will show:
     - General
     - Shift Requirements
     - Rotation Rosters
     - Shift Pattern
   - The Rotation Rosters tab will use the offshore E / L / N / D / WO pattern workflow.

4. **Seed the offshore shift pattern if missing**
   - When the offshore partnership is opened, ensure the offshore shift code preset exists:
     - E = Early
     - L = Late
     - N = Night
     - D = Day
     - WO = Weekend Off / Recovery

5. **Keep Central unchanged**
   - `Troubleshooting Central` remains its own partnership.
   - `Turbine Troubleshooting Offshore` remains its own team/partnership and is configured from the same Team Scheduler partnership settings location.

## Technical notes

- Existing team found: `Turbine Troubleshooting Offshore`.
- Existing partnership found: `Troubleshooting Central`, currently linked only to `Turbine Troubleshooting Central - North, West, East, South`.
- No new database tables are needed.
- This requires one data change to `team_planning_partners` plus small UI/business-logic changes around offshore partnership detection and the configuration dialog.