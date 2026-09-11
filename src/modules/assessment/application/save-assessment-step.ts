import type { AssessmentStepCommand } from "../contracts/assessment-step";
import {
  getNextRequiredStep,
  isTargetWeightCompatible,
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
    }
  | {
      ok: false;
      code: "STEP_VALUE_INCONSISTENT";
      nextRequiredStep: "TARGET_WEIGHT";
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

  if (
    input.step === "TARGET_WEIGHT" &&
    !isTargetWeightCompatible({
      ...current.answers,
      targetWeightKg: input.value,
    })
  ) {
    return {
      ok: false,
      code: "STEP_VALUE_INCONSISTENT",
      nextRequiredStep: "TARGET_WEIGHT",
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
