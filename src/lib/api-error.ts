import { NextResponse } from "next/server";

export function apiError(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  return NextResponse.json(
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
