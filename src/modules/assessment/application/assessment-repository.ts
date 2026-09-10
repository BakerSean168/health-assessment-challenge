import type { AssessmentForStepWrite, Gender } from "../domain/assessment";

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

export interface AssessmentRepository {
  saveGender(input: SaveGenderInput): Promise<SaveGenderPersistenceResult>;
}
