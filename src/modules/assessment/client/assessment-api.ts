import type {
  ActivityLevel,
  AssessmentAnswers,
  AssessmentStep,
  Gender,
  Goal,
} from "../domain/assessment";

export type AssessmentStepValue = Gender | Goal | ActivityLevel | number;

export interface AssessmentRecoveryDto {
  status: "IN_PROGRESS" | "COMPLETED";
  nextRequiredStep: AssessmentStep | null;
  revision: number;
  answers: Required<AssessmentAnswers>;
}

export interface SaveAssessmentStepDto {
  saved: true;
  revision: number;
  nextRequiredStep: AssessmentStep | null;
}

export interface SubmitAssessmentDto {
  status: "COMPLETED";
  resultReady: true;
}

export interface AssessmentBrowserApi {
  bootstrapSession(): Promise<void>;
  getAssessment(): Promise<AssessmentRecoveryDto>;
  saveStep(
    step: AssessmentStep,
    value: AssessmentStepValue,
    expectedRevision: number,
  ): Promise<SaveAssessmentStepDto>;
  submitAssessment(expectedRevision: number): Promise<SubmitAssessmentDto>;
}

export class AssessmentBrowserApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AssessmentBrowserApiError";
  }
}

const routeKeyByStep: Record<AssessmentStep, string> = {
  GENDER: "gender",
  GOAL: "goal",
  ACTIVITY: "activity",
  HEIGHT: "height",
  WEIGHT: "weight",
  AGE: "age",
  TARGET_WEIGHT: "target-weight",
};

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = body as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new AssessmentBrowserApiError(
      errorBody?.error?.message ?? "The request could not be completed.",
      errorBody?.error?.code,
      response.status,
    );
  }

  return body as T;
}

export const browserAssessmentApi: AssessmentBrowserApi = {
  async bootstrapSession() {
    await requestJson("/api/session", { method: "POST" });
  },

  getAssessment() {
    return requestJson<AssessmentRecoveryDto>("/api/assessment");
  },

  saveStep(step, value, expectedRevision) {
    return requestJson<SaveAssessmentStepDto>(
      `/api/assessment/steps/${routeKeyByStep[step]}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value, expectedRevision }),
      },
    );
  },

  submitAssessment(expectedRevision) {
    return requestJson<SubmitAssessmentDto>("/api/assessment/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision }),
    });
  },
};
