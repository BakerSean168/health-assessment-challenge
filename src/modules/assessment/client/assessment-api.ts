import { requestJson, BrowserApiError } from "@/lib/browser-api";

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

export interface SessionBootstrapDto {
  orderId: string;
  subscriptionStatus: "FREE" | "ACTIVE";
  assessment: AssessmentRecoveryDto;
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
  prewarmSession(): Promise<SessionBootstrapDto>;
  bootstrapSession(): Promise<SessionBootstrapDto>;
  getAssessment(): Promise<AssessmentRecoveryDto>;
  saveStep(
    step: AssessmentStep,
    value: AssessmentStepValue,
    expectedRevision: number,
  ): Promise<SaveAssessmentStepDto>;
  submitAssessment(expectedRevision: number): Promise<SubmitAssessmentDto>;
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

export { BrowserApiError as AssessmentBrowserApiError };

let prewarmedSession: Promise<SessionBootstrapDto> | null = null;
let prewarmedAt = 0;
const SESSION_PREWARM_TTL_MS = 30_000;

function requestSessionBootstrap() {
  return requestJson<SessionBootstrapDto>("/api/session", { method: "POST" });
}

function createPrewarm() {
  prewarmedAt = Date.now();
  const request = requestSessionBootstrap().catch((error) => {
    if (prewarmedSession === request) {
      prewarmedSession = null;
      prewarmedAt = 0;
    }
    throw error;
  });
  prewarmedSession = request;
  return request;
}

export const browserAssessmentApi: AssessmentBrowserApi = {
  prewarmSession() {
    if (
      prewarmedSession &&
      Date.now() - prewarmedAt <= SESSION_PREWARM_TTL_MS
    ) {
      return prewarmedSession;
    }
    return createPrewarm();
  },

  bootstrapSession() {
    if (
      prewarmedSession &&
      Date.now() - prewarmedAt <= SESSION_PREWARM_TTL_MS
    ) {
      const request = prewarmedSession;
      prewarmedSession = null;
      prewarmedAt = 0;
      return request;
    }
    prewarmedSession = null;
    prewarmedAt = 0;
    return requestSessionBootstrap();
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
