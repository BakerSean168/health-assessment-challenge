"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NumericAnswerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}

export function NumericAnswer({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit,
  disabled,
}: NumericAnswerProps) {
  const id = `assessment-${label.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          aria-label={label}
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 px-4 text-lg [appearance:textfield] md:text-lg [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}
