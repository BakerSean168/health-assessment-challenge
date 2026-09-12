import { CheckCircle2, Clock3, Sparkles, Target } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AssessmentStartLink } from "./assessment-start-link";

export function AssessmentLanding() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100dvh-6rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Personalized wellness assessment
          </div>

          <div className="space-y-4">
            <h1 className="max-w-2xl font-heading text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Build your wellness snapshot
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Answer a few quick questions to better understand your current
              body metrics and get personalized insights for your goal.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="size-4" aria-hidden="true" />
              Takes about 2 minutes
            </span>
            <span className="inline-flex items-center gap-2">
              <Target className="size-4" aria-hidden="true" />
              Personalized to your goal
            </span>
          </div>

          <AssessmentStartLink />

          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            For general wellness information only. Results are estimates and are
            not medical advice.
          </p>
        </section>

        <Card className="w-full">
          <CardHeader>
            <CardDescription>What you&apos;ll get</CardDescription>
            <CardTitle className="text-2xl">A clearer view of your goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                BMI snapshot
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                See where your current body mass index falls.
              </p>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Daily calorie estimate
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Get an estimate based on your profile, activity, and goal.
              </p>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Goal timeline
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                See an estimated timeline toward your target weight.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
