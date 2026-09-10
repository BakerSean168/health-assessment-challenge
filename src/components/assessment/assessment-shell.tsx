"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface AssessmentShellProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  footer?: ReactNode;
}

export function AssessmentShell({
  stepNumber,
  totalSteps,
  title,
  description,
  children,
  onBack,
  footer,
}: AssessmentShellProps) {
  const progressValue = Math.round((stepNumber / totalSteps) * 100);

  return (
    <main className="min-h-dvh bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div className="flex min-h-8 items-center justify-between gap-4">
            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Go back"
                onClick={onBack}
              >
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
            ) : (
              <span aria-hidden="true" />
            )}
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              Step {stepNumber} of {totalSteps}
            </span>
          </div>
          <Progress
            value={progressValue}
            aria-label={`Assessment progress: step ${stepNumber} of ${totalSteps}`}
          />
        </header>

        <Card className="shadow-sm">
          <CardContent className="flex flex-col gap-7 py-2 sm:py-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Your assessment
              </p>
              <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
                {title}
              </h1>
              {description ? (
                <p className="max-w-prose text-sm leading-6 text-muted-foreground sm:text-base">
                  {description}
                </p>
              ) : null}
            </div>

            <div>{children}</div>
          </CardContent>
        </Card>

        {footer ? <div>{footer}</div> : null}
      </div>
    </main>
  );
}
