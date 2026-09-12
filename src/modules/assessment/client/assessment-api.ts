import { requestJson, BrowserApiError } from "@/lib/browser-api";

import {
  assessmentRecoveryDtoSchema,
  type AssessmentRecoveryDto,
  saveAssessmentStepDtoSchema,
  type SaveAssessmentStepDto,
  sessionBootstrapDtoSchema,
  type SessionBootstrapDto,
  submitAssessmentDtoSchema,
  type SubmitAssessmentDto,
} from "../contracts/assessment-api";
import {
  domainStepToRouteStep,
  type AssessmentStepCommand,
} from "../contracts/assessment-step";
import type { SubmitAssessmentRequest } from "../contracts/submit-assessment";

export type {
  AssessmentRecoveryDto,
  SaveAssessmentStepDto,
  SessionBootstrapDto,
  SubmitAssessmentDto,
} from "../contracts/assessment-api";

export interface AssessmentBrowserApi {
  prewarmSession(): Promise<SessionBootstrapDto>;
  bootstrapSession(): Promise<SessionBootstrapDto>;
  getAssessment(): Promise<AssessmentRecoveryDto>;
  saveStep(command: AssessmentStepCommand): Promise<SaveAssessmentStepDto>;
  submitAssessment(expectedRevision: number): Promise<SubmitAssessmentDto>;
}

export { BrowserApiError as AssessmentBrowserApiError };

let prewarmedSession: Promise<SessionBootstrapDto> | null = null;
let prewarmedAt = 0;
const SESSION_PREWARM_TTL_MS = 30_000;

function requestSessionBootstrap() {
  return requestJson("/api/session", sessionBootstrapDtoSchema, { method: "POST" });
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
    return requestJson("/api/assessment", assessmentRecoveryDtoSchema);
  },

  saveStep(command) {
    return requestJson(
      `/api/assessment/steps/${domainStepToRouteStep[command.step]}`,
      saveAssessmentStepDtoSchema,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          value: command.value,
          expectedRevision: command.expectedRevision,
        }),
      },
    );
  },

  submitAssessment(expectedRevision) {
    const body: SubmitAssessmentRequest = { expectedRevision };
    return requestJson("/api/assessment/submit", submitAssessmentDtoSchema, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
};
