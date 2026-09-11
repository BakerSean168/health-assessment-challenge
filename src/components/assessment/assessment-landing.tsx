import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function AssessmentLanding() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100dvh-6rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Progressive health-assessment demo
          </div>

          <div className="space-y-4">
            <h1 className="max-w-2xl font-heading text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Build your wellness snapshot
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Answer 7 short questions to generate a deterministic BMI, intake,
              and goal-date demo. Your progress is saved after every step, so
              you can safely refresh and continue.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              7 short questions
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Server-saved progress
            </span>
          </div>

          <Link
            href="/assessment"
            className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
          >
            Start my assessment
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>

          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            Engineering demonstration only. The generated result is not medical
            advice and no real payment is collected.
          </p>
        </section>

        <Card className="w-full">
          <CardHeader>
            <CardDescription>What this demo proves</CardDescription>
            <CardTitle className="text-2xl">A complete persisted flow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="font-medium">Progressive persistence</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Each answer is validated and saved before the funnel advances.
              </p>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="font-medium">Versioned result snapshot</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Submission produces one deterministic result that is reused on
                later reads instead of silently recalculating.
              </p>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="font-medium">Real access boundary</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Free responses omit protected values; a simulated payment
                unlocks the same stored result server-side.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
