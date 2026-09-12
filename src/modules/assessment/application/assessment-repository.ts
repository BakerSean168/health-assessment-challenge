import type { AssessmentStepCommand } from "../contracts/assessment-step";
import type {
  AssessmentAnswers,
  AssessmentStatus,
} from "../domain/assessment";

export type SaveAssessmentStepInput = AssessmentStepCommand & {
  sessionId: string;
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
  status: AssessmentStatus;
  revision: number;
  answers: Required<AssessmentAnswers>;
}

export interface AssessmentRepository {
  findBySessionId(sessionId: string): Promise<AssessmentState | null>;
  saveStep(input: SaveAssessmentStepInput): Promise<SaveStepPersistenceResult>;
}
