import { z } from "zod";

import {
  apiErrorEnvelopeSchema,
  type ApiErrorCode,
} from "@/contracts/api-error";

export type BrowserApiErrorCode = ApiErrorCode | "INVALID_SERVER_RESPONSE";

export class BrowserApiError extends Error {
  constructor(
    message: string,
    readonly code?: BrowserApiErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BrowserApiError";
  }
}

export async function requestJson<Schema extends z.ZodType>(
  input: RequestInfo | URL,
  responseSchema: Schema,
  init?: RequestInit,
): Promise<z.output<Schema>> {
  const response = await fetch(input, init);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = apiErrorEnvelopeSchema.safeParse(body);
    throw new BrowserApiError(
      parsedError.success
        ? parsedError.data.error.message
        : "The request could not be completed.",
      parsedError.success ? parsedError.data.error.code : undefined,
      response.status,
    );
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new BrowserApiError(
      "The server returned a response that does not match the shared API contract.",
      "INVALID_SERVER_RESPONSE",
      response.status,
    );
  }

  return parsed.data;
}
