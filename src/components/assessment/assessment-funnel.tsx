"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { calculateBmi } from "@/modules/assessment/domain/calculation";
import {
  assessmentAnswerPatchForCommand,
  domainStepToRouteStep,
  parseAssessmentStepRequest,
  type AssessmentStepCommand,
} from "@/modules/assessment/contracts/assessment-step";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACTIVITY_LEVEL_VALUES,
  ASSESSMENT_STEP_VALUES,
  COMPLETED_ASSESSMENT_STATUS,
  GENDER_VALUES,
  GOAL_VALUES,
  type ActivityLevel,
  type AssessmentAnswers,
  type AssessmentStep,
  type Gender,
  type Goal,
} from "@/modules/assessment/domain/assessment";
import { ASSESSMENT_INPUT_LIMITS } from "@/modules/assessment/domain/input-limits";
import {
  AssessmentBrowserApiError,
  browserAssessmentApi,
  type AssessmentBrowserApi,
  type AssessmentRecoveryDto,
} from "@/modules/assessment/client/assessment-api";
import { AssessmentOptionGroup } from "./assessment-option-group";
import { BmiPreview } from "./bmi-preview";
import { AssessmentShell } from "./assessment-shell";
import { NumericAnswer } from "./numeric-answer";

const STEP_ORDER = ASSESSMENT_STEP_VALUES;

const GENDER_LABELS = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
} satisfies Record<Gender, string>;

const GOAL_LABELS = {
  LOSE_WEIGHT: "Lose weight",
  MAINTAIN: "Maintain my weight",
  GAIN_WEIGHT: "Gain weight",
} satisfies Record<Goal, string>;

const ACTIVITY_LEVEL_LABELS = {
  SEDENTARY: "Mostly sedentary",
  LIGHT: "Lightly active",
  MODERATE: "Moderately active",
  ACTIVE: "Very active",
  VERY_ACTIVE: "Highly active",
} satisfies Record<ActivityLevel, string>;

type OptionQuestion = {
  kind: "option";
  title: string;
  description: string;
  ariaLabel: string;
  options: readonly { value: string; label: string }[];
};

type NumericQuestion = {
  kind: "numeric";
  title: string;
  description: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
};

const questionByStep = {
  GENDER: {
    kind: "option",
    title: "Which best describes you?",
    description: "This helps personalize your results.",
    ariaLabel: "Gender",
    options: GENDER_VALUES.map((value) => ({
      value,
      label: GENDER_LABELS[value],
    })),
  },
  GOAL: {
    kind: "option",
    title: "What is your main goal?",
    description: "Choose what you'd like to work toward.",
    ariaLabel: "Goal",
    options: GOAL_VALUES.map((value) => ({
      value,
      label: GOAL_LABELS[value],
    })),
  },
  ACTIVITY: {
    kind: "option",
    title: "How active are you in a typical week?",
    description:
      "Pick the option that most closely reflects your normal routine.",
    ariaLabel: "Activity level",
    options: ACTIVITY_LEVEL_VALUES.map((value) => ({
      value,
      label: ACTIVITY_LEVEL_LABELS[value],
    })),
  },
  HEIGHT: {
    kind: "numeric",
    title: "How tall are you?",
    description: "We'll use this with your current weight to calculate BMI.",
    label: "Height",
    min: ASSESSMENT_INPUT_LIMITS.heightCm.min,
    max: ASSESSMENT_INPUT_LIMITS.heightCm.max,
    step: 0.1,
    unit: "cm",
  },
  WEIGHT: {
    kind: "numeric",
    title: "What is your current weight?",
    description: "Use your current measurement rather than an estimate.",
    label: "Current weight",
    min: ASSESSMENT_INPUT_LIMITS.weightKg.min,
    max: ASSESSMENT_INPUT_LIMITS.weightKg.max,
    step: 0.1,
    unit: "kg",
  },
  AGE: {
    kind: "numeric",
    title: "How old are you?",
    description: "Age helps tailor your daily calorie estimate.",
    label: "Age",
    min: ASSESSMENT_INPUT_LIMITS.age.min,
    max: ASSESSMENT_INPUT_LIMITS.age.max,
    step: 1,
    unit: "years",
  },
  TARGET_WEIGHT: {
    kind: "numeric",
    title: "What is your target weight?",
    description:
      "Your target helps us estimate a possible timeline toward your goal.",
    label: "Target weight",
    min: ASSESSMENT_INPUT_LIMITS.targetWeightKg.min,
    max: ASSESSMENT_INPUT_LIMITS.targetWeightKg.max,
    step: 0.1,
    unit: "kg",
  },
} as const satisfies Record<AssessmentStep, OptionQuestion | NumericQuestion>;

function assertNever(value: never): never {
  throw new Error(`Unexpected assessment variant: ${JSON.stringify(value)}`);
}

function valueForStep(
  answers: Required<AssessmentAnswers>,
  step: AssessmentStep,
): string {
  switch (step) {
    case "GENDER":
      return answers.gender ?? "";
    case "GOAL":
      return answers.goal ?? "";
    case "ACTIVITY":
      return answers.activityLevel ?? "";
    case "HEIGHT":
      return answers.heightCm?.toString() ?? "";
    case "WEIGHT":
      return answers.weightKg?.toString() ?? "";
    case "AGE":
      return answers.age?.toString() ?? "";
    case "TARGET_WEIGHT":
      return answers.targetWeightKg?.toString() ?? "";
    default:
      return assertNever(step);
  }
}

function withStepValue(
  answers: Required<AssessmentAnswers>,
  command: AssessmentStepCommand,
): Required<AssessmentAnswers> {
  return {
    ...answers,
    ...assessmentAnswerPatchForCommand(command),
  };
}

function parseDraftCommand(
  step: AssessmentStep,
  draft: string,
  expectedRevision: number,
): AssessmentStepCommand | null {
  if (!draft) return null;

  const rawValue = questionByStep[step].kind === "numeric" ? Number(draft) : draft;
  if (typeof rawValue === "number" && !Number.isFinite(rawValue)) return null;

  const parsed = parseAssessmentStepRequest(domainStepToRouteStep[step], {
    value: rawValue,
    expectedRevision,
  });

  return parsed.success ? parsed.data : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "We could not save this answer. Please try again.";
}

function LoadingAssessment() {
  return (
    <main className="min-h-dvh bg-background px-4 py-10">
      <Card className="mx-auto w-full max-w-xl">
        <CardContent className="space-y-5 py-4">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </main>
  );
}

function SubmittingAssessment() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 py-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold">
              Creating your wellness profile
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              We’re putting your wellness profile together based on your answers.
            </p>
          </div>
          <Skeleton className="mx-auto h-2 w-4/5" />
        </CardContent>
      </Card>
    </main>
  );
}

interface AssessmentFunnelProps {
  api?: AssessmentBrowserApi;
  onComplete: () => void;
  onOrderResolved?: (orderId: string) => void;
}

export function AssessmentFunnel({
  api = browserAssessmentApi,
  onComplete,
  onOrderResolved,
}: AssessmentFunnelProps) {
  const [assessment, setAssessment] = useState<AssessmentRecoveryDto | null>(null);
  const [displayStep, setDisplayStep] = useState<AssessmentStep | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishAssessment = useCallback(
    async (revision: number) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await api.submitAssessment(revision);
        onComplete();
      } catch (caught) {
        const submitError = errorMessage(caught);

        // A submit can commit successfully even if its HTTP response is lost.
        // Re-read canonical server state before telling the user it failed, so
        // retry-safe submit semantics are reflected in the browser as well.
        try {
          const recovered = await api.getAssessment();
          if (recovered.status === COMPLETED_ASSESSMENT_STATUS) {
            onComplete();
            return;
          }

          setAssessment(recovered);
          if (recovered.nextRequiredStep) {
            setDisplayStep(recovered.nextRequiredStep);
            setDraftValue(
              valueForStep(recovered.answers, recovered.nextRequiredStep),
            );
          }
        } catch {
          // Preserve the original submit failure: the recovery read is best
          // effort and should not hide the operation the user attempted.
        }

        setError(submitError);
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, onComplete],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const bootstrap = await api.bootstrapSession();
        if (cancelled) return;
        onOrderResolved?.(bootstrap.orderId);
        const recovered = bootstrap.assessment;

        if (recovered.status === COMPLETED_ASSESSMENT_STATUS) {
          onComplete();
          return;
        }

        setAssessment(recovered);
        setDisplayStep(recovered.nextRequiredStep);

        if (recovered.nextRequiredStep) {
          setDraftValue(
            valueForStep(recovered.answers, recovered.nextRequiredStep),
          );
          return;
        }

        await finishAssessment(recovered.revision);
      } catch (caught) {
        if (!cancelled) setError(errorMessage(caught));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, finishAssessment, onComplete, onOrderResolved]);

  const stepIndex = useMemo(
    () => (displayStep ? STEP_ORDER.indexOf(displayStep) : -1),
    [displayStep],
  );

  const goBack = useCallback(() => {
    if (!assessment || stepIndex <= 0) return;
    const previous = STEP_ORDER[stepIndex - 1];
    if (!previous) return;
    setDisplayStep(previous);
    setDraftValue(valueForStep(assessment.answers, previous));
    setError(null);
  }, [assessment, stepIndex]);

  async function continueFromStep() {
    if (!assessment || !displayStep) return;

    const command = parseDraftCommand(
      displayStep,
      draftValue,
      assessment.revision,
    );
    if (command === null) {
      setError("Choose or enter a valid value before continuing.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const saved = await api.saveStep(command);
      const answers = withStepValue(assessment.answers, command);
      const nextAssessment: AssessmentRecoveryDto = {
        ...assessment,
        revision: saved.revision,
        nextRequiredStep: saved.nextRequiredStep,
        answers,
      };
      setAssessment(nextAssessment);

      if (!saved.nextRequiredStep) {
        setIsSaving(false);
        await finishAssessment(saved.revision);
        return;
      }

      setDisplayStep(saved.nextRequiredStep);
      setDraftValue(valueForStep(answers, saved.nextRequiredStep));
    } catch (caught) {
      const originalError = errorMessage(caught);

      // A PATCH may have committed even when its response was interrupted.
      // Reconcile with canonical state after any failed write; only advance
      // automatically when the server revision proves state changed.
      try {
        const recovered = await api.getAssessment();
        if (recovered.status === COMPLETED_ASSESSMENT_STATUS) {
          onComplete();
          return;
        }

        const canonicalAdvanced = recovered.revision !== assessment.revision;
        setAssessment(recovered);

        if (canonicalAdvanced) {
          if (recovered.nextRequiredStep) {
            setDisplayStep(recovered.nextRequiredStep);
            setDraftValue(
              valueForStep(recovered.answers, recovered.nextRequiredStep),
            );
            setError(
              caught instanceof AssessmentBrowserApiError &&
                caught.code === "ASSESSMENT_VERSION_CONFLICT"
                ? "Your assessment changed in another tab. We refreshed the latest saved progress."
                : "We restored the latest saved progress after the connection was interrupted.",
            );
            return;
          }

          await finishAssessment(recovered.revision);
          return;
        }
      } catch {
        // Keep the original write failure if recovery itself is unavailable.
      }

      setError(originalError);
    } finally {
      setIsSaving(false);
    }
  }

  if (isSubmitting) {
    return <SubmittingAssessment />;
  }

  if (!assessment || !displayStep || stepIndex < 0) {
    return (
      <>
        <LoadingAssessment />
        {error ? (
          <div className="fixed inset-x-4 bottom-4 mx-auto max-w-xl">
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Unable to load assessment</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
      </>
    );
  }

  const question = questionByStep[displayStep];
  const title = question.title;
  const description = question.description;
  const parsedDraftCommand = parseDraftCommand(
    displayStep,
    draftValue,
    assessment.revision,
  );
  const canContinue = parsedDraftCommand !== null;
  const bmiPreviewContext =
    displayStep === "WEIGHT"
      ? "current"
      : displayStep === "TARGET_WEIGHT"
        ? "target"
        : null;
  const bmiPreview =
    bmiPreviewContext &&
    parsedDraftCommand &&
    typeof parsedDraftCommand.value === "number" &&
    assessment.answers.heightCm != null
      ? calculateBmi({
          heightCm: assessment.answers.heightCm,
          weightKg: parsedDraftCommand.value,
        })
      : null;

  return (
    <AssessmentShell
      stepNumber={stepIndex + 1}
      totalSteps={STEP_ORDER.length}
      title={title}
      description={description}
      {...(stepIndex > 0 ? { onBack: goBack } : {})}
      footer={
        <div className="space-y-3">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>We could not save this answer</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="h-11 w-full"
            disabled={!canContinue || isSaving}
            onClick={() => void continueFromStep()}
          >
            {isSaving ? "Saving…" : "Continue"}
          </Button>
        </div>
      }
    >
      {question.kind === "option" ? (
        <AssessmentOptionGroup
          value={draftValue}
          onValueChange={setDraftValue}
          options={question.options}
          ariaLabel={question.ariaLabel}
          disabled={isSaving}
        />
      ) : (
        <div className="space-y-4">
          <NumericAnswer
            label={question.label}
            value={draftValue}
            onChange={setDraftValue}
            min={question.min}
            max={question.max}
            step={question.step}
            unit={question.unit}
            disabled={isSaving}
          />
          {bmiPreview && bmiPreviewContext ? (
            <BmiPreview
              bmi={bmiPreview.bmi}
              category={bmiPreview.category}
              context={bmiPreviewContext}
            />
          ) : null}
        </div>
      )}
    </AssessmentShell>
  );
}
