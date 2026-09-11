import { NextResponse } from "next/server";

export const PRIVATE_API_CACHE_CONTROL = "private, no-store";

export function privateJson<T>(body: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", PRIVATE_API_CACHE_CONTROL);

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}
