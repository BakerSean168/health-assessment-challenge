import { requestJson } from "@/lib/browser-api";
import type { ResultDto } from "../domain/result-projection";

export interface DemoPaymentDto {
  status: "SUCCEEDED";
  subscriptionStatus: "ACTIVE";
  replayed: boolean;
}

export interface ResultBrowserApi {
  getResult(): Promise<ResultDto>;
  pay(idempotencyKey: string): Promise<DemoPaymentDto>;
}

export const browserResultApi: ResultBrowserApi = {
  getResult() {
    return requestJson<ResultDto>("/api/assessment/result");
  },

  pay(idempotencyKey) {
    return requestJson<DemoPaymentDto>("/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey }),
    });
  },
};
