export type SubscriptionStatus = "FREE" | "ACTIVE";
export type AssessmentStatus = "IN_PROGRESS" | "COMPLETED";

export interface SessionAssessment {
  id: string;
  status: AssessmentStatus;
  revision: number;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
}

export interface AnonymousSessionAggregate {
  id: string;
  subscriptionStatus: SubscriptionStatus;
  assessment: SessionAssessment | null;
}
