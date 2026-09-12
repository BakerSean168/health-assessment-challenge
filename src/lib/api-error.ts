import {
  API_ERROR_STATUS_BY_CODE,
  apiErrorEnvelopeSchema,
  type ApiErrorCode,
  type ApiErrorDetails,
} from "@/contracts/api-error";
import { privateJson } from "@/lib/api-response";

export function apiError<Code extends ApiErrorCode>(
  code: Code,
  message: string,
  details: ApiErrorDetails<Code>,
) {
  const body = apiErrorEnvelopeSchema.parse({
    error: { code, message, details },
  });

  return privateJson(body, { status: API_ERROR_STATUS_BY_CODE[code] });
}
