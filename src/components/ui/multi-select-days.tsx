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

const DAYS = [
  { label: "Monday", value: 0 },
  { label: "Tuesday", value: 1 },
  { label: "Wednesday", value: 2 },
  { label: "Thursday", value: 3 },
  { label: "Friday", value: 4 },
  { label: "Saturday", value: 5 },
  { label: "Sunday", value: 6 },
];

interface MultiSelectDaysProps {
  value?: number[] | null;
  onValueChange?: (value: number[] | null) => void;
  disabled?: boolean;
}

export function MultiSelectDays({ value, onValueChange, disabled = false }: MultiSelectDaysProps) {
  const [open, setOpen] = React.useState(false);
  const selectedDays = value || [];
  const isAllDays = !value || value.length === 0;

  const toggleDay = (dayValue: number) => {
    let newSelection: number[];
    if (selectedDays.includes(dayValue)) {
      newSelection = selectedDays.filter((d) => d !== dayValue);
    } else {
      newSelection = [...selectedDays, dayValue].sort();
    }
    onValueChange?.(newSelection.length === 0 ? null : newSelection);
  };

  const toggleAllDays = () => {
    onValueChange?.(null);
  };

  const getDisplayText = () => {
    if (isAllDays) return "All Days";
    if (selectedDays.length === 7) return "All Days";
    if (selectedDays.length === 0) return "All Days";
    if (selectedDays.length === 1) {
      return DAYS.find((d) => d.value === selectedDays[0])?.label || "Select days";
    }
    
    // Check for consecutive days
    const sorted = [...selectedDays].sort((a, b) => a - b);
    let isConsecutive = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        isConsecutive = false;
        break;
      }
    }
    
    if (isConsecutive) {
      const first = DAYS.find((d) => d.value === sorted[0])?.label;
      const last = DAYS.find((d) => d.value === sorted[sorted.length - 1])?.label;
      return `${first} - ${last}`;
    }
    
    return `${selectedDays.length} days selected`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[180px] justify-between"
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
              <CommandItem
                onSelect={toggleAllDays}
                className="cursor-pointer"
              >
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
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedDays.includes(day.value) && !isAllDays
                        ? "opacity-100"
                        : "opacity-0"
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
