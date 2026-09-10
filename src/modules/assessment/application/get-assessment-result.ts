import { projectFreeResult } from "../domain/result-projection";
import type { AssessmentResultRepository } from "./result-repository";

export type GetAssessmentResultResult =
  | {
      ok: true;
      result: ReturnType<typeof projectFreeResult>;
    }
  | {
      ok: false;
      code: "RESULT_NOT_FOUND";
    };

export async function getAssessmentResult(
  sessionId: string,
  repository: AssessmentResultRepository,
): Promise<GetAssessmentResultResult> {
  const readModel = await repository.findBySessionId(sessionId);

  if (!readModel) {
    return { ok: false, code: "RESULT_NOT_FOUND" };
  }

  return {
    ok: true,
    result: projectFreeResult(readModel.result),
  };
}
