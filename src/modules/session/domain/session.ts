import type {
  AssessmentAnswers,
  AssessmentStatus,
} from "../../assessment/domain/assessment";

export const SUBSCRIPTION_STATUS_VALUES = ["FREE", "ACTIVE"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

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
