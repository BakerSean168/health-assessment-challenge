import type {
  AssessmentAnswers,
  AssessmentForStepWrite,
  Gender,
} from "../domain/assessment";

export interface SaveGenderInput {
  sessionId: string;
  gender: Gender;
  expectedRevision: number;
}

export type SaveGenderPersistenceResult =
  | {
      kind: "saved";
      assessment: AssessmentForStepWrite;
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
  saveGender(input: SaveGenderInput): Promise<SaveGenderPersistenceResult>;
}
