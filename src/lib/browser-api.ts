import { z } from "zod";

export class BrowserApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BrowserApiError";
  }
}

const apiErrorBodySchema = z
  .object({
    error: z
      .object({
        code: z.string().optional(),
        message: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export async function requestJson<Schema extends z.ZodType>(
  input: RequestInfo | URL,
  responseSchema: Schema,
  init?: RequestInit,
): Promise<z.output<Schema>> {
  const response = await fetch(input, init);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = apiErrorBodySchema.safeParse(body);
    throw new BrowserApiError(
      parsedError.success
        ? (parsedError.data.error.message ?? "The request could not be completed.")
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
