import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Country {
  code: string;
  name: string;
}

interface MultiSelectCountriesProps {
  countries: Country[];
  selectedCountryCodes: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
}

export function MultiSelectCountries({
  countries,
  selectedCountryCodes,
  onValueChange,
  placeholder = "Select countries...",
}: MultiSelectCountriesProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (countryCode: string) => {
    const newSelection = selectedCountryCodes.includes(countryCode)
      ? selectedCountryCodes.filter((code) => code !== countryCode)
      : [...selectedCountryCodes, countryCode];
    onValueChange(newSelection);
  };

  const selectedCountries = countries.filter((country) =>
    selectedCountryCodes.includes(country.code)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex gap-1 flex-wrap">
            {selectedCountries.length > 0 ? (
              selectedCountries.map((country) => (
                <Badge key={country.code} variant="secondary" className="text-xs">
                  {country.code}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search countries..." />
          <CommandEmpty>No country found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {countries.map((country) => (
              <CommandItem
                key={country.code}
                value={country.name}
                onSelect={() => handleSelect(country.code)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedCountryCodes.includes(country.code)
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
                <span className="font-mono text-xs mr-2">{country.code}</span>
                {country.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
