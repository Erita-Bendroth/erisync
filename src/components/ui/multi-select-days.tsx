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

interface MultiSelectDaysProps {
  value?: number[] | null;
  onValueChange?: (value: number[] | null) => void;
  disabled?: boolean;
}

const DAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

export function MultiSelectDays({ value, onValueChange, disabled = false }: MultiSelectDaysProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDays = value || [];
  const isAllDays = !value || value.length === 0;

  const toggleDay = (day: number) => {
    if (isAllDays) {
      // If "All Days" is selected, select just this day
      onValueChange?.([day]);
    } else {
      const newSelection = selectedDays.includes(day)
        ? selectedDays.filter((d) => d !== day)
        : [...selectedDays, day].sort();
      
      // If all days deselected, set to null (All Days)
      onValueChange?.(newSelection.length === 0 ? null : newSelection);
    }
  };

  const toggleAllDays = () => {
    onValueChange?.(null);
  };

  const getDisplayText = () => {
    if (isAllDays) return "All Days";
    if (selectedDays.length === 1) {
      return DAYS.find((d) => d.value === selectedDays[0])?.label || "Select days";
    }
    if (selectedDays.length === DAYS.length) return "All Days";
    return `${selectedDays.length} days selected`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[160px] justify-between"
          disabled={disabled}
        >
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search days..." />
          <CommandList>
            <CommandEmpty>No day found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={toggleAllDays}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    isAllDays ? "opacity-100" : "opacity-0"
                  )}
                />
                All Days
              </CommandItem>
              {DAYS.map((day) => (
                <CommandItem
                  key={day.value}
                  onSelect={() => toggleDay(day.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !isAllDays && selectedDays.includes(day.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {day.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
