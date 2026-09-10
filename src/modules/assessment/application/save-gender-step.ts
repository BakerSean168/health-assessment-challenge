import {
  getNextRequiredStep,
  type Gender,
} from "../domain/assessment";
import type { AssessmentRepository } from "./assessment-repository";

export interface SaveGenderStepInput {
  sessionId: string;
  value: Gender;
  expectedRevision: number;
}

export type SaveGenderStepResult =
  | {
      ok: true;
      revision: number;
      nextRequiredStep: ReturnType<typeof getNextRequiredStep>;
    }
  | {
      ok: false;
      code: "ASSESSMENT_NOT_FOUND" | "ASSESSMENT_VERSION_CONFLICT";
    };

export async function saveGenderStep(
  input: SaveGenderStepInput,
  repository: AssessmentRepository,
): Promise<SaveGenderStepResult> {
  const persisted = await repository.saveGender({
    sessionId: input.sessionId,
    gender: input.value,
    expectedRevision: input.expectedRevision,
  });

  if (persisted.kind === "not_found") {
    return { ok: false, code: "ASSESSMENT_NOT_FOUND" };
  }

  if (persisted.kind === "conflict") {
    return { ok: false, code: "ASSESSMENT_VERSION_CONFLICT" };
  }

  return {
    ok: true,
    revision: persisted.assessment.revision,
    nextRequiredStep: getNextRequiredStep({
      gender: persisted.assessment.gender,
    }),
  };
}
