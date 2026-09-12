import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { BrowserApiError, requestJson } from "./browser-api";

const responseSchema = z.object({ ok: z.literal(true), revision: z.number().int() }).strict();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser API runtime trust boundary", () => {
  it("returns data only after the shared response schema accepts it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, revision: 4 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(requestJson("/test", responseSchema)).resolves.toEqual({
      ok: true,
      revision: 4,
    });
  });

  it("fails closed when a successful HTTP response violates the shared contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, revision: "4" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(requestJson("/test", responseSchema)).rejects.toMatchObject({
      name: "BrowserApiError",
      code: "INVALID_SERVER_RESPONSE",
      status: 200,
    } satisfies Partial<BrowserApiError>);
  });
});
