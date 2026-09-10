"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface AssessmentOption {
  value: string;
  label: string;
  description?: string;
}

interface AssessmentOptionGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly AssessmentOption[];
  ariaLabel: string;
  disabled?: boolean;
}

export function AssessmentOptionGroup({
  value,
  onValueChange,
  options,
  ariaLabel,
  disabled,
}: AssessmentOptionGroupProps) {
  return (
    <RadioGroup
      aria-label={ariaLabel}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      className="gap-3"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background px-4 py-3.5 transition-colors has-data-checked:border-primary has-data-checked:bg-muted/60 hover:bg-muted/40"
        >
          <RadioGroupItem value={option.value} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{option.label}</span>
            {option.description ? (
              <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                {option.description}
              </span>
            ) : null}
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
