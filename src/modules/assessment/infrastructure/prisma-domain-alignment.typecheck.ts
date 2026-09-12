import type { Prisma } from "../../../generated/prisma/client";
import type {
  ActivityLevel as PrismaActivityLevel,
  AssessmentStatus as PrismaAssessmentStatus,
  BmiCategory as PrismaBmiCategory,
  Gender as PrismaGender,
  Goal as PrismaGoal,
  PaymentStatus as PrismaPaymentStatus,
  SubscriptionStatus as PrismaSubscriptionStatus,
} from "../../../generated/prisma/enums";
import type { PaymentStatus } from "../../payment/domain/payment";
import type { SubscriptionStatus } from "../../session/domain/session";
import type {
  ActivityLevel,
  AssessmentAggregateState,
  AssessmentAnswers,
  AssessmentStatus,
  Gender,
  Goal,
} from "../domain/assessment";
import type { BmiCategory } from "../domain/calculation";
import type { AssessmentResultSnapshot } from "../domain/result-projection";

type Exact<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false;

type AssertTrue<Value extends true> = Value;

type PrismaAssessment = Prisma.AssessmentGetPayload<Record<string, never>>;
type PrismaAssessmentResult = Prisma.AssessmentResultGetPayload<Record<string, never>>;
type DomainAnswerRecord = Required<AssessmentAnswers>;
type PrismaAnswerRecord = Pick<PrismaAssessment, keyof DomainAnswerRecord>;
type DomainAssessmentCore = Pick<
  AssessmentAggregateState,
  "id" | "status" | "revision"
>;
type PrismaAssessmentCore = Pick<PrismaAssessment, keyof DomainAssessmentCore>;
type PrismaResultSnapshot = Pick<
  PrismaAssessmentResult,
  keyof AssessmentResultSnapshot
>;

export type PrismaDomainAlignment = {
  enums: {
    gender: AssertTrue<Exact<Gender, PrismaGender>>;
    goal: AssertTrue<Exact<Goal, PrismaGoal>>;
    activityLevel: AssertTrue<Exact<ActivityLevel, PrismaActivityLevel>>;
    assessmentStatus: AssertTrue<Exact<AssessmentStatus, PrismaAssessmentStatus>>;
    bmiCategory: AssertTrue<Exact<BmiCategory, PrismaBmiCategory>>;
    subscriptionStatus: AssertTrue<
      Exact<SubscriptionStatus, PrismaSubscriptionStatus>
    >;
    paymentStatus: AssertTrue<Exact<PaymentStatus, PrismaPaymentStatus>>;
  };
  assessmentAnswers: AssertTrue<Exact<DomainAnswerRecord, PrismaAnswerRecord>>;
  assessmentCore: AssertTrue<Exact<DomainAssessmentCore, PrismaAssessmentCore>>;
  resultSnapshot: AssertTrue<
    Exact<AssessmentResultSnapshot, PrismaResultSnapshot>
  >;
};
