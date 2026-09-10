import type {
  ActivityLevel,
  AssessmentAnswers,
  Gender,
  Goal,
} from "../domain/assessment";

export type SaveAssessmentStepInput =
  | { sessionId: string; step: "GENDER"; value: Gender; expectedRevision: number }
  | { sessionId: string; step: "GOAL"; value: Goal; expectedRevision: number }
  | {
      sessionId: string;
      step: "ACTIVITY";
      value: ActivityLevel;
      expectedRevision: number;
    }
  | { sessionId: string; step: "HEIGHT"; value: number; expectedRevision: number }
  | { sessionId: string; step: "WEIGHT"; value: number; expectedRevision: number }
  | { sessionId: string; step: "AGE"; value: number; expectedRevision: number }
  | {
      sessionId: string;
      step: "TARGET_WEIGHT";
      value: number;
      expectedRevision: number;
    };

export type SaveStepPersistenceResult =
  | {
      kind: "saved";
      assessment: AssessmentState;
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "conflict";
    };

export interface AssessmentState {
  id: string;
  status: "IN_PROGRESS" | "COMPLETED";
  revision: number;
  answers: Required<AssessmentAnswers>;
}

export interface AssessmentRepository {
  findBySessionId(sessionId: string): Promise<AssessmentState | null>;
  saveStep(input: SaveAssessmentStepInput): Promise<SaveStepPersistenceResult>;
}
