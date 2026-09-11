"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { calculateBmi, type BmiCategory } from "@/modules/assessment/domain/calculation";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AssessmentAnswers,
  AssessmentStep,
} from "@/modules/assessment/domain/assessment";
import { ASSESSMENT_INPUT_LIMITS } from "@/modules/assessment/domain/input-limits";
import {
  browserAssessmentApi,
  type AssessmentBrowserApi,
  type AssessmentRecoveryDto,
  type AssessmentStepValue,
} from "@/modules/assessment/client/assessment-api";
import { AssessmentOptionGroup } from "./assessment-option-group";
import { AssessmentShell } from "./assessment-shell";
import { NumericAnswer } from "./numeric-answer";

const STEP_ORDER: readonly AssessmentStep[] = [
  "GENDER",
  "GOAL",
  "ACTIVITY",
  "HEIGHT",
  "WEIGHT",
  "AGE",
  "TARGET_WEIGHT",
];

const optionQuestions = {
  GENDER: {
    title: "Which best describes you?",
    description:
      "This helps personalize your results.",
    ariaLabel: "Gender",
    options: [
      { value: "MALE", label: "Male" },
      { value: "FEMALE", label: "Female" },
      { value: "OTHER", label: "Other" },
    ],
  },
  GOAL: {
    title: "What is your main goal?",
    description: "Choose what you'd like to work toward.",
    ariaLabel: "Goal",
    options: [
      { value: "LOSE_WEIGHT", label: "Lose weight" },
      { value: "MAINTAIN", label: "Maintain my weight" },
      { value: "GAIN_WEIGHT", label: "Gain weight" },
    ],
  },
  ACTIVITY: {
    title: "How active are you in a typical week?",
    description:
      "Pick the option that most closely reflects your normal routine.",
    ariaLabel: "Activity level",
    options: [
      { value: "SEDENTARY", label: "Mostly sedentary" },
      { value: "LIGHT", label: "Lightly active" },
      { value: "MODERATE", label: "Moderately active" },
      { value: "ACTIVE", label: "Very active" },
      { value: "VERY_ACTIVE", label: "Highly active" },
    ],
  },
} as const;

const numericQuestions = {
  HEIGHT: {
    title: "How tall are you?",
    description: "We'll use this with your current weight to calculate BMI.",
    label: "Height",
    min: ASSESSMENT_INPUT_LIMITS.heightCm.min,
    max: ASSESSMENT_INPUT_LIMITS.heightCm.max,
    step: 0.1,
    unit: "cm",
  },
  WEIGHT: {
    title: "What is your current weight?",
    description: "Use your current measurement rather than an estimate.",
    label: "Current weight",
    min: ASSESSMENT_INPUT_LIMITS.weightKg.min,
    max: ASSESSMENT_INPUT_LIMITS.weightKg.max,
    step: 0.1,
    unit: "kg",
  },
  AGE: {
    title: "How old are you?",
    description: "Age helps tailor your daily calorie estimate.",
    label: "Age",
    min: ASSESSMENT_INPUT_LIMITS.age.min,
    max: ASSESSMENT_INPUT_LIMITS.age.max,
    step: 1,
    unit: "years",
  },
  TARGET_WEIGHT: {
    title: "What is your target weight?",
    description:
      "Your target helps us estimate a possible timeline toward your goal.",
    label: "Target weight",
    min: ASSESSMENT_INPUT_LIMITS.targetWeightKg.min,
    max: ASSESSMENT_INPUT_LIMITS.targetWeightKg.max,
    step: 0.1,
    unit: "kg",
  },
} as const;

type OptionStep = keyof typeof optionQuestions;
type NumericStep = keyof typeof numericQuestions;

function isOptionStep(step: AssessmentStep): step is OptionStep {
  return step in optionQuestions;
}

function isNumericStep(step: AssessmentStep): step is NumericStep {
  return step in numericQuestions;
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
  }
}

function withStepValue(
  answers: Required<AssessmentAnswers>,
  step: AssessmentStep,
  value: AssessmentStepValue,
): Required<AssessmentAnswers> {
  switch (step) {
    case "GENDER":
      return { ...answers, gender: value as Required<AssessmentAnswers>["gender"] };
    case "GOAL":
      return { ...answers, goal: value as Required<AssessmentAnswers>["goal"] };
    case "ACTIVITY":
      return {
        ...answers,
        activityLevel: value as Required<AssessmentAnswers>["activityLevel"],
      };
    case "HEIGHT":
      return { ...answers, heightCm: value as number };
    case "WEIGHT":
      return { ...answers, weightKg: value as number };
    case "AGE":
      return { ...answers, age: value as number };
    case "TARGET_WEIGHT":
      return { ...answers, targetWeightKg: value as number };
  }
}

function parseDraftValue(step: AssessmentStep, draft: string): AssessmentStepValue | null {
  if (!draft) return null;
  if (isOptionStep(step)) return draft as AssessmentStepValue;

  const numeric = Number(draft);
  if (!Number.isFinite(numeric)) return null;

  const config = numericQuestions[step as NumericStep];
  if (numeric < config.min || numeric > config.max) return null;
  if (step === "AGE" && !Number.isInteger(numeric)) return null;

  return numeric;
}

function bmiCategoryLabel(category: BmiCategory): string {
  return {
    UNDERWEIGHT: "Underweight",
    NORMAL: "Normal range",
    OVERWEIGHT: "Overweight",
    OBESE: "Obese range",
  }[category];
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
}

export function AssessmentFunnel({
  api = browserAssessmentApi,
  onComplete,
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
        setError(errorMessage(caught));
        setIsSubmitting(false);
      }
    },
    [api, onComplete],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await api.bootstrapSession();
        const recovered = await api.getAssessment();
        if (cancelled) return;

        if (recovered.status === "COMPLETED") {
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
  }, [api, finishAssessment, onComplete]);

  const stepIndex = useMemo(
    () => (displayStep ? STEP_ORDER.indexOf(displayStep) : -1),
    [displayStep],
  );

  const goBack = useCallback(() => {
    if (!assessment || stepIndex <= 0) return;
    const previous = STEP_ORDER[stepIndex - 1];
    setDisplayStep(previous);
    setDraftValue(valueForStep(assessment.answers, previous));
    setError(null);
  }, [assessment, stepIndex]);

  async function continueFromStep() {
    if (!assessment || !displayStep) return;

    const value = parseDraftValue(displayStep, draftValue);
    if (value === null) {
      setError("Choose or enter a valid value before continuing.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const saved = await api.saveStep(
        displayStep,
        value,
        assessment.revision,
      );
      const answers = withStepValue(assessment.answers, displayStep, value);
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
      setError(errorMessage(caught));
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

  const optionQuestion = isOptionStep(displayStep)
    ? optionQuestions[displayStep]
    : null;
  const numericQuestion = isNumericStep(displayStep)
    ? numericQuestions[displayStep]
    : null;
  const title = optionQuestion?.title ?? numericQuestion?.title ?? "Assessment";
  const description = optionQuestion?.description ?? numericQuestion?.description;
  const parsedDraftValue = parseDraftValue(displayStep, draftValue);
  const canContinue = parsedDraftValue !== null;
  const bmiPreview =
    displayStep === "WEIGHT" &&
    typeof parsedDraftValue === "number" &&
    assessment.answers.heightCm != null
      ? calculateBmi({
          heightCm: assessment.answers.heightCm,
          weightKg: parsedDraftValue,
        })
      : null;

  return (
    <AssessmentShell
      stepNumber={stepIndex + 1}
      totalSteps={STEP_ORDER.length}
      title={title}
      description={description}
      onBack={stepIndex > 0 ? goBack : undefined}
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
      {optionQuestion ? (
        <AssessmentOptionGroup
          value={draftValue}
          onValueChange={setDraftValue}
          options={optionQuestion.options}
          ariaLabel={optionQuestion.ariaLabel}
          disabled={isSaving}
        />
      ) : numericQuestion ? (
        <div className="space-y-4">
          <NumericAnswer
            label={numericQuestion.label}
            value={draftValue}
            onChange={setDraftValue}
            min={numericQuestion.min}
            max={numericQuestion.max}
            step={numericQuestion.step}
            unit={numericQuestion.unit}
            disabled={isSaving}
          />
          {bmiPreview ? (
            <Card size="sm" className="bg-muted/30" aria-live="polite">
              <CardContent className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="font-medium">Your BMI</p>
                  <p className="text-sm text-muted-foreground">
                    {bmiCategoryLabel(bmiPreview.category)}
                  </p>
                </div>
                <p className="font-heading text-3xl font-semibold tabular-nums">
                  {bmiPreview.bmi}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </AssessmentShell>
  );
}
