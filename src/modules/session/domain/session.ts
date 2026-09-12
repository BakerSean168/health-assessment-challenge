import type { AssessmentAggregateState } from "../../assessment/domain/assessment";

export const SUBSCRIPTION_STATUS_VALUES = ["FREE", "ACTIVE"] as const;
export const FREE_SUBSCRIPTION_STATUS = SUBSCRIPTION_STATUS_VALUES[0];
export const ACTIVE_SUBSCRIPTION_STATUS = SUBSCRIPTION_STATUS_VALUES[1];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

export type SessionAssessment = AssessmentAggregateState;

export interface AnonymousSessionAggregate {
  id: string;
  subscriptionStatus: SubscriptionStatus;
  assessment: SessionAssessment | null;
}
