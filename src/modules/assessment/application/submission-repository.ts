import type { AssessmentCalculationResult } from "../domain/calculation";
import type { AssessmentState } from "./assessment-repository";

export interface SubmissionState {
  assessment: AssessmentState;
  hasResult: boolean;
}

export type CompleteAssessmentPersistenceResult =
  | { kind: "completed" }
  | { kind: "replayed" }
  | { kind: "not_found" }
  | { kind: "conflict" };

export interface CompleteAssessmentInput {
  sessionId: string;
  expectedRevision: number;
  completedAt: Date;
  result: AssessmentCalculationResult;
}

export interface AssessmentSubmissionRepository {
  findSubmissionState(sessionId: string): Promise<SubmissionState | null>;
  completeAssessment(
    input: CompleteAssessmentInput,
  ): Promise<CompleteAssessmentPersistenceResult>;
}
