"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { BmiCategory } from "@/modules/assessment/domain/calculation";

interface BmiPreviewProps {
  bmi: number;
  category: BmiCategory;
}

const categoryCopy: Record<
  BmiCategory,
  {
    title: string;
    description: string;
    className: string;
    icon: "check" | "warning";
    iconClassName: string;
  }
> = {
  NORMAL: {
    title: "Within the standard range",
    description: "Your BMI falls within the standard adult range.",
    className: "border-emerald-500/30 bg-emerald-500/10",
    icon: "check",
    iconClassName: "text-emerald-500",
  },
  UNDERWEIGHT: {
    title: "Below the standard range",
    description:
      "Your BMI is below the standard adult range. If this is unexpected, consider discussing it with a healthcare professional.",
    className: "border-destructive/30 bg-destructive/10",
    icon: "warning",
    iconClassName: "text-destructive",
  },
  OVERWEIGHT: {
    title: "Above the standard range",
    description:
      "Your BMI is above the standard adult range. BMI is one screening measure and does not diagnose health status.",
    className: "border-amber-500/30 bg-amber-500/10",
    icon: "warning",
    iconClassName: "text-amber-500",
  },
  OBESE: {
    title: "Well above the standard range",
    description:
      "Your BMI is well above the standard adult range. Consider discussing it with a healthcare professional if you have concerns.",
    className: "border-destructive/30 bg-destructive/10",
    icon: "warning",
    iconClassName: "text-destructive",
  },
};

export function BmiPreview({ bmi, category }: BmiPreviewProps) {
  const copy = categoryCopy[category];
  const Icon = copy.icon === "check" ? CheckCircle2 : TriangleAlert;

  return (
    <Card
      size="sm"
      role="status"
      aria-live="polite"
      data-bmi-category={category}
      className={copy.className}
    >
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <Icon className={`mt-0.5 size-5 shrink-0 ${copy.iconClassName}`} aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">{copy.title}</p>
            <p className="text-sm leading-5 text-muted-foreground">{copy.description}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-medium text-muted-foreground">Your BMI</p>
          <p className="font-heading text-3xl font-semibold tabular-nums">{bmi}</p>
        </div>
      </CardContent>
    </Card>
  );
}
