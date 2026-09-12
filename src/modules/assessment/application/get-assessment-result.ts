import { ERROR_CODE } from "@/contracts/error-code";

import { projectResult } from "../domain/result-projection";
import type { AssessmentResultRepository } from "./result-repository";

export type GetAssessmentResultResult =
  | {
      ok: true;
      result: ReturnType<typeof projectResult>;
    }
  | {
      ok: false;
      code: typeof ERROR_CODE.RESULT_NOT_FOUND;
    };

export async function getAssessmentResult(
  sessionId: string,
  repository: AssessmentResultRepository,
): Promise<GetAssessmentResultResult> {
  const readModel = await repository.findBySessionId(sessionId);

  if (!readModel) {
    return { ok: false, code: ERROR_CODE.RESULT_NOT_FOUND };
  }

  return {
    ok: true,
    result: projectResult(readModel.result, readModel.subscriptionStatus),
  };
}
