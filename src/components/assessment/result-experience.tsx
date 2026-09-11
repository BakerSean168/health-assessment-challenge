"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Flame,
  LockKeyhole,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  browserResultApi,
  type ResultBrowserApi,
} from "@/modules/assessment/client/result-api";
import type { ResultDto } from "@/modules/assessment/domain/result-projection";

function categoryLabel(category: ResultDto["bmi"]["category"]): string {
  return {
    UNDERWEIGHT: "Underweight",
    NORMAL: "Normal range",
    OVERWEIGHT: "Overweight",
    OBESE: "Obese range",
  }[category];
}

function formatCalories(value: number): string {
  return `${new Intl.NumberFormat("en-US").format(value)} kcal/day`;
}

function formatCalendarDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function ResultLoading() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-lg" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      </div>
    </main>
  );
}

interface LockedMetricProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function LockedMetric({ icon, title, description }: LockedMetricProps) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <LockKeyhole className="size-4" aria-hidden="true" />
          Locked
        </div>
      </CardContent>
    </Card>
  );
}

interface ResultExperienceProps {
  api?: ResultBrowserApi;
  idempotencyKeyFactory?: () => string;
}

export function ResultExperience({
  api = browserResultApi,
  idempotencyKeyFactory = () => crypto.randomUUID(),
}: ResultExperienceProps) {
  const [result, setResult] = useState<ResultDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const paymentKey = useRef<string | null>(null);

  const loadResult = useCallback(async () => {
    try {
      const next = await api.getResult();
      setLoadError(null);
      setResult(next);
      return next;
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The result could not be loaded.",
      );
      return null;
    }
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    void api
      .getResult()
      .then((next) => {
        if (cancelled) return;
        setLoadError(null);
        setResult(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "The result could not be loaded.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  async function completeDemoPayment() {
    paymentKey.current ??= idempotencyKeyFactory();
    setIsPaying(true);
    setPaymentError(null);

    try {
      await api.pay(paymentKey.current);
      const unlocked = await loadResult();
      if (unlocked?.access === "ACTIVE") {
        setPaywallOpen(false);
      }
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "The demo payment could not be completed.",
      );
    } finally {
      setIsPaying(false);
    }
  }

  if (!result) {
    return (
      <>
        <ResultLoading />
        {loadError ? (
          <div className="fixed inset-x-4 bottom-4 mx-auto max-w-xl">
            <Alert variant="destructive">
              <RefreshCw aria-hidden="true" />
              <AlertTitle>Unable to load your result</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{loadError}</p>
                <Button type="button" variant="outline" onClick={() => void loadResult()}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl space-y-7">
        <header className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Assessment complete
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Your wellness profile
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            This is a deterministic engineering-demo result based on your saved answers.
            It is not medical advice.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardDescription>Body mass index</CardDescription>
            <div className="flex items-end justify-between gap-4">
              <CardTitle className="text-4xl tabular-nums">{result.bmi.value}</CardTitle>
              <span className="text-sm font-semibold">{categoryLabel(result.bmi.category)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Separator />
            <p className="text-sm leading-6 text-muted-foreground">
              BMI is shown as a screening-style metric and does not diagnose health status.
            </p>
          </CardContent>
        </Card>

        <section aria-label="Personalized result" className="grid gap-4 md:grid-cols-2">
          {result.access === "FREE" ? (
            <>
              <LockedMetric
                icon={<Flame className="size-4" aria-hidden="true" />}
                title="Recommended daily intake"
                description="Your demo calorie estimate"
              />
              <LockedMetric
                icon={<CalendarDays className="size-4" aria-hidden="true" />}
                title="Estimated goal date"
                description="Your static demo projection"
              />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <Flame className="size-4" aria-hidden="true" />
                  </div>
                  <CardDescription>Recommended daily intake</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {formatCalories(result.recommendedDailyCalories.value)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <CalendarDays className="size-4" aria-hidden="true" />
                  </div>
                  <CardDescription>Estimated goal date</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatCalendarDate(result.estimatedGoalDate.value)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </>
          )}
        </section>

        {result.access === "FREE" ? (
          <Card className="overflow-hidden">
            <CardContent className="grid gap-5 py-2 sm:grid-cols-[1fr_auto] sm:items-center sm:py-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Sparkles className="size-4" aria-hidden="true" />
                  Your full result is ready
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Unlock the stored calorie estimate and goal-date projection with the simulated payment flow.
                </p>
              </div>
              <Button type="button" size="lg" onClick={() => setPaywallOpen(true)}>
                Unlock my full result
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Full result unlocked</AlertTitle>
            <AlertDescription>
              These values come from the same result snapshot created when you submitted the assessment.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Dialog open={paywallOpen} onOpenChange={setPaywallOpen}>
        <DialogContent aria-label="Unlock your full result">
          <DialogHeader>
            <DialogTitle>Unlock your full result</DialogTitle>
            <DialogDescription>
              This challenge uses a simulated payment only. No card details or real money are involved.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
            The server will switch this anonymous session from FREE to ACTIVE, then the same result endpoint will be fetched again.
          </div>

          {paymentError ? (
            <Alert variant="destructive">
              <RefreshCw aria-hidden="true" />
              <AlertTitle>Demo payment needs another try</AlertTitle>
              <AlertDescription>{paymentError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={isPaying}
              onClick={() => void completeDemoPayment()}
            >
              {isPaying
                ? "Processing…"
                : paymentError
                  ? "Try demo payment again"
                  : "Complete demo payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
