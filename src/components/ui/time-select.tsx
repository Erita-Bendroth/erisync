import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  stepMinutes?: number;
  label?: string;
  className?: string;
}

// Generates 24h time options like 00:00, 00:30 ... 23:30
const buildTimes = (step: number) => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      options.push(`${hh}:${mm}`);
    }
  }
  return options;
};

export const TimeSelect: React.FC<TimeSelectProps> = ({ value, onChange, stepMinutes = 30, className }) => {
  const times = React.useMemo(() => buildTimes(stepMinutes), [stepMinutes]);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background border z-50 max-h-72">
        {times.map((t) => (
          <SelectItem key={t} value={t}>{t}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default TimeSelect;
