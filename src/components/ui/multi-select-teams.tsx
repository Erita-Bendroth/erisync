import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Team {
  id: string;
  name: string;
}

interface MultiSelectTeamsProps {
  teams: Team[];
  selectedTeamIds: string[];
  onValueChange: (teamIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelectTeams({
  teams,
  selectedTeamIds,
  onValueChange,
  placeholder = "Select teams",
  disabled = false,
}: MultiSelectTeamsProps) {
  const [open, setOpen] = React.useState(false);

  const toggleTeam = (teamId: string) => {
    const newSelection = selectedTeamIds.includes(teamId)
      ? selectedTeamIds.filter((id) => id !== teamId)
      : [...selectedTeamIds, teamId];
    onValueChange(newSelection);
  };

  const selectedTeamNames = teams
    .filter((team) => selectedTeamIds.includes(team.id))
    .map((team) => team.name)
    .join(", ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedTeamIds.length > 0 ? selectedTeamNames : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search teams..." />
          <CommandList>
            <CommandEmpty>No teams found.</CommandEmpty>
            <CommandGroup>
              {teams.map((team) => (
                <CommandItem
                  key={team.id}
                  value={team.name}
                  onSelect={() => toggleTeam(team.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedTeamIds.includes(team.id)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {team.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
