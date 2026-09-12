import type { ActivateSubscriptionResult } from "../../payment/application/activate-subscription";
import type { PayResponse } from "../../payment/contracts/pay";
import { projectAssessmentRecovery } from "../application/get-assessment";
import { projectResult } from "../domain/result-projection";
import type { AssessmentRecoveryDto, ResultDto } from "./assessment-api";

type Exact<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false;

type AssertTrue<Value extends true> = Value;

type SuccessfulPaymentResult = Omit<
  Extract<ActivateSubscriptionResult, { ok: true }>,
  "ok"
>;

export type ApplicationApiContractAlignment = {
  assessmentRecovery: AssertTrue<
    Exact<ReturnType<typeof projectAssessmentRecovery>, AssessmentRecoveryDto>
  >;
  resultProjection: AssertTrue<Exact<ReturnType<typeof projectResult>, ResultDto>>;
  paymentResponse: AssertTrue<Exact<SuccessfulPaymentResult, PayResponse>>;
};
