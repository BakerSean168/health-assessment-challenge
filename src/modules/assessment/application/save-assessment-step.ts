import { getNextRequiredStep } from "../domain/assessment";
import type { AssessmentStepCommand } from "../contracts/assessment-step";
import type { AssessmentRepository } from "./assessment-repository";

export type SaveAssessmentStepInput = AssessmentStepCommand & {
  sessionId: string;
};

export type SaveAssessmentStepResult =
  | {
      ok: true;
      revision: number;
      nextRequiredStep: ReturnType<typeof getNextRequiredStep>;
    }
  | {
      ok: false;
      code: "ASSESSMENT_NOT_FOUND" | "ASSESSMENT_VERSION_CONFLICT";
    };

export async function saveAssessmentStep(
  input: SaveAssessmentStepInput,
  repository: AssessmentRepository,
): Promise<SaveAssessmentStepResult> {
  const persisted = await repository.saveStep(input);

  if (persisted.kind === "not_found") {
    return { ok: false, code: "ASSESSMENT_NOT_FOUND" };
  }

  if (persisted.kind === "conflict") {
    return { ok: false, code: "ASSESSMENT_VERSION_CONFLICT" };
  }

  return {
    ok: true,
    revision: persisted.assessment.revision,
    nextRequiredStep: getNextRequiredStep(persisted.assessment.answers),
  };
}
