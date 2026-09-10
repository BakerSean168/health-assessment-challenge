import { getNextRequiredStep } from "../domain/assessment";
import type { AssessmentRepository } from "./assessment-repository";

export type GetAssessmentResult =
  | {
      ok: true;
      assessment: {
        status: "IN_PROGRESS" | "COMPLETED";
        nextRequiredStep: ReturnType<typeof getNextRequiredStep>;
        revision: number;
        answers: {
          gender: "MALE" | "FEMALE" | "OTHER" | null;
          goal: null;
          activityLevel: null;
          heightCm: null;
          weightKg: null;
          age: null;
          targetWeightKg: null;
        };
      };
    }
  | {
      ok: false;
      code: "ASSESSMENT_NOT_FOUND";
    };

export async function getAssessment(
  sessionId: string,
  repository: AssessmentRepository,
): Promise<GetAssessmentResult> {
  const assessment = await repository.findBySessionId(sessionId);

  if (!assessment) {
    return { ok: false, code: "ASSESSMENT_NOT_FOUND" };
  }

  return {
    ok: true,
    assessment: {
      status: assessment.status,
      nextRequiredStep:
        assessment.status === "COMPLETED"
          ? null
          : getNextRequiredStep(assessment.answers),
      revision: assessment.revision,
      answers: {
        gender: assessment.answers.gender,
        goal: null,
        activityLevel: null,
        heightCm: null,
        weightKg: null,
        age: null,
        targetWeightKg: null,
      },
    },
  };
}
