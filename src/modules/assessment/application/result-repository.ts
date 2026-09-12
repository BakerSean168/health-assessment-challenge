import type { SubscriptionStatus } from "../../session/domain/session";
import type { AssessmentResultSnapshot } from "../domain/result-projection";

export interface ResultReadModel {
  subscriptionStatus: SubscriptionStatus;
  result: AssessmentResultSnapshot;
}

export interface AssessmentResultRepository {
  findBySessionId(sessionId: string): Promise<ResultReadModel | null>;
}
