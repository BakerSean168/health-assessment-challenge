import type { AssessmentAnswers } from "../../assessment/domain/assessment";

export type SubscriptionStatus = "FREE" | "ACTIVE";
export type AssessmentStatus = "IN_PROGRESS" | "COMPLETED";

export interface SessionAssessment extends Required<AssessmentAnswers> {
  id: string;
  status: AssessmentStatus;
  revision: number;
}

export interface AnonymousSessionAggregate {
  id: string;
  subscriptionStatus: SubscriptionStatus;
  assessment: SessionAssessment | null;
}
