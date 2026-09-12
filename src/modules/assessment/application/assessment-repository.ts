import type { AssessmentStepCommand } from "../contracts/assessment-step";
import type { AssessmentAggregateState } from "../domain/assessment";

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

export type AssessmentState = AssessmentAggregateState;

export interface AssessmentRepository {
  findBySessionId(sessionId: string): Promise<AssessmentState | null>;
  saveStep(input: SaveAssessmentStepInput): Promise<SaveStepPersistenceResult>;
}
