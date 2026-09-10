import type { AssessmentResultSnapshot } from "../domain/result-projection";

export interface ResultReadModel {
  subscriptionStatus: "FREE" | "ACTIVE";
  result: AssessmentResultSnapshot;
}

export interface AssessmentResultRepository {
  findBySessionId(sessionId: string): Promise<ResultReadModel | null>;
}
