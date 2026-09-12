import { requestJson } from "@/lib/browser-api";
import {
  resultDtoSchema,
  type ResultDto,
} from "../contracts/assessment-api";
import {
  type PayRequest,
  type PayResponse,
  payResponseSchema,
} from "../../payment/contracts/pay";

export type { ResultDto } from "../contracts/assessment-api";
export type { PayResponse as DemoPaymentDto } from "../../payment/contracts/pay";

export interface ResultBrowserApi {
  getResult(): Promise<ResultDto>;
  pay(idempotencyKey: string): Promise<PayResponse>;
}

export const browserResultApi: ResultBrowserApi = {
  getResult() {
    return requestJson("/api/assessment/result", resultDtoSchema);
  },

  pay(idempotencyKey) {
    const body: PayRequest = { idempotencyKey };
    return requestJson("/api/pay", payResponseSchema, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
};
