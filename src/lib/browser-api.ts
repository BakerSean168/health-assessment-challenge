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

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = body as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new BrowserApiError(
      errorBody?.error?.message ?? "The request could not be completed.",
      errorBody?.error?.code,
      response.status,
    );
  }

  return body as T;
}
