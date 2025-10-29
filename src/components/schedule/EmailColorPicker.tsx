import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type EmailCellColor = 'white' | 'green' | 'yellow' | 'red' | 'orange';

interface EmailColorPickerProps {
  value: EmailCellColor;
  onChange: (color: EmailCellColor) => void;
}

const colorMap: Record<EmailCellColor, { bg: string; label: string; border: string }> = {
  white: { bg: 'bg-white', label: 'White', border: 'border-gray-300' },
  green: { bg: 'bg-green-200', label: 'Green', border: 'border-green-400' },
  yellow: { bg: 'bg-yellow-200', label: 'Yellow', border: 'border-yellow-400' },
  red: { bg: 'bg-red-200', label: 'Red', border: 'border-red-400' },
  orange: { bg: 'bg-orange-200', label: 'Orange', border: 'border-orange-400' },
};

export function EmailColorPicker({ value, onChange }: EmailColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="w-24 justify-start gap-2"
        >
          <div className={`w-4 h-4 rounded border ${colorMap[value].bg} ${colorMap[value].border}`} />
          <span className="text-xs">{colorMap[value].label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div className="grid grid-cols-1 gap-1">
          {(Object.entries(colorMap) as [EmailCellColor, typeof colorMap[EmailCellColor]][]).map(([color, { bg, label, border }]) => (
            <Button
              key={color}
              variant={value === color ? "default" : "ghost"}
              size="sm"
              onClick={() => onChange(color)}
              className="justify-start gap-2"
            >
              <div className={`w-4 h-4 rounded border ${bg} ${border}`} />
              <span>{label}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
