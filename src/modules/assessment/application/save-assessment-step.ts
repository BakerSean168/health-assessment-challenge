import type { AssessmentStepCommand } from "../contracts/assessment-step";
import {
  getNextRequiredStep,
  validateStepWrite,
} from "../domain/assessment";
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
    }
  | {
      ok: false;
      code: "STEP_OUT_OF_ORDER";
      nextRequiredStep: ReturnType<typeof getNextRequiredStep>;
    }
  | {
      ok: false;
      code: "ASSESSMENT_ALREADY_COMPLETED";
    };

export async function saveAssessmentStep(
  input: SaveAssessmentStepInput,
  repository: AssessmentRepository,
): Promise<SaveAssessmentStepResult> {
  const current = await repository.findBySessionId(input.sessionId);

  if (!current) {
    return { ok: false, code: "ASSESSMENT_NOT_FOUND" };
  }

  if (current.status === "COMPLETED") {
    return { ok: false, code: "ASSESSMENT_ALREADY_COMPLETED" };
  }

  if (current.revision !== input.expectedRevision) {
    return { ok: false, code: "ASSESSMENT_VERSION_CONFLICT" };
  }

  const policy = validateStepWrite(current.answers, input.step);
  if (!policy.allowed) {
    return {
      ok: false,
      code: "STEP_OUT_OF_ORDER",
      nextRequiredStep: policy.nextRequiredStep,
    };
  }

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
