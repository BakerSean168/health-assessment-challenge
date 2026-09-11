import { privateJson } from "@/lib/api-response";

export function apiError(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  return privateJson(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}
