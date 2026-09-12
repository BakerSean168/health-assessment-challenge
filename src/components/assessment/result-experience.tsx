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
import type { ResultDto } from "@/modules/assessment/contracts/assessment-api";
import {
  ACTIVE_SUBSCRIPTION_STATUS,
  FREE_SUBSCRIPTION_STATUS,
} from "@/modules/session/domain/session";

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

  async function unlockResults() {
    paymentKey.current ??= idempotencyKeyFactory();
    setIsPaying(true);
    setPaymentError(null);

    try {
      await api.pay(paymentKey.current);
      const unlocked = await loadResult();
      if (unlocked?.access === ACTIVE_SUBSCRIPTION_STATUS) {
        setPaywallOpen(false);
      }
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "We couldn’t unlock your results. Please try again.",
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
            Your results are based on the information you provided and are intended for general wellness guidance only. They are not medical advice.
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
          {result.access === FREE_SUBSCRIPTION_STATUS ? (
            <>
              <LockedMetric
                icon={<Flame className="size-4" aria-hidden="true" />}
                title="Recommended daily intake"
                description="Personalized calorie guidance"
              />
              <LockedMetric
                icon={<CalendarDays className="size-4" aria-hidden="true" />}
                title="Estimated goal date"
                description="A timeline based on your target"
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

        {result.access === FREE_SUBSCRIPTION_STATUS ? (
          <Card className="overflow-hidden">
            <CardContent className="grid gap-5 py-2 sm:grid-cols-[1fr_auto] sm:items-center sm:py-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Sparkles className="size-4" aria-hidden="true" />
                  Unlock your complete profile
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  See your personalized daily calorie target and estimated goal timeline.
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
            <AlertTitle>Your complete profile is ready</AlertTitle>
            <AlertDescription>
              Your personalized calorie target and goal timeline are now available.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Dialog open={paywallOpen} onOpenChange={setPaywallOpen}>
        <DialogContent aria-label="Unlock your complete profile">
          <DialogHeader>
            <DialogTitle>Unlock your complete profile</DialogTitle>
            <DialogDescription>
              See your personalized daily calorie target and estimated goal timeline.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
            No payment details are required and you won’t be charged.
          </div>

          {paymentError ? (
            <Alert variant="destructive">
              <RefreshCw aria-hidden="true" />
              <AlertTitle>We couldn’t unlock your results</AlertTitle>
              <AlertDescription>{paymentError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={isPaying}
              onClick={() => void unlockResults()}
            >
              {isPaying
                ? "Processing…"
                : paymentError
                  ? "Try again"
                  : "Unlock my results"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
