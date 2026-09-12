import { ERROR_CODE } from "@/contracts/error-code";
import { assertNever } from "@/lib/assert-never";

import {
  COMPLETED_ASSESSMENT_STATUS,
  getNextRequiredStep,
  isTargetWeightCompatible,
  validateStepWrite,
} from "../domain/assessment";
import type {
  AssessmentRepository,
  SaveAssessmentStepInput,
} from "./assessment-repository";

export type SaveAssessmentStepResult =
  | {
      ok: true;
      revision: number;
      nextRequiredStep: ReturnType<typeof getNextRequiredStep>;
    }
  | {
      ok: false;
      code: typeof ERROR_CODE.ASSESSMENT_NOT_FOUND;
    }
  | {
      ok: false;
      code: typeof ERROR_CODE.ASSESSMENT_VERSION_CONFLICT;
    }
  | {
      ok: false;
      code: typeof ERROR_CODE.STEP_OUT_OF_ORDER;
      nextRequiredStep: ReturnType<typeof getNextRequiredStep>;
    }
  | {
      ok: false;
      code: typeof ERROR_CODE.ASSESSMENT_ALREADY_COMPLETED;
    }
  | {
      ok: false;
      code: typeof ERROR_CODE.STEP_VALUE_INCONSISTENT;
      nextRequiredStep: "TARGET_WEIGHT";
    };

export async function saveAssessmentStep(
  input: SaveAssessmentStepInput,
  repository: AssessmentRepository,
): Promise<SaveAssessmentStepResult> {
  const current = await repository.findBySessionId(input.sessionId);

  if (!current) {
    return { ok: false, code: ERROR_CODE.ASSESSMENT_NOT_FOUND };
  }

  if (current.status === COMPLETED_ASSESSMENT_STATUS) {
    return { ok: false, code: ERROR_CODE.ASSESSMENT_ALREADY_COMPLETED };
  }

  if (current.revision !== input.expectedRevision) {
    return { ok: false, code: ERROR_CODE.ASSESSMENT_VERSION_CONFLICT };
  }

  const policy = validateStepWrite(current.answers, input.step);
  if (!policy.allowed) {
    return {
      ok: false,
      code: ERROR_CODE.STEP_OUT_OF_ORDER,
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
      code: ERROR_CODE.STEP_VALUE_INCONSISTENT,
      nextRequiredStep: "TARGET_WEIGHT",
    };
  }

  const persisted = await repository.saveStep(input);

  switch (persisted.kind) {
    case "saved":
      return {
        ok: true,
        revision: persisted.assessment.revision,
        nextRequiredStep: getNextRequiredStep(persisted.assessment.answers),
      };
    case "not_found":
      return { ok: false, code: ERROR_CODE.ASSESSMENT_NOT_FOUND };
    case "conflict":
      return { ok: false, code: ERROR_CODE.ASSESSMENT_VERSION_CONFLICT };
    default:
      return assertNever(persisted, "assessment step persistence result");
  }
}
