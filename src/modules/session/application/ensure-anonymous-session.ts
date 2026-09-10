import { z } from "zod";

import type { AnonymousSessionAggregate } from "../domain/session";
import type { AnonymousSessionRepository } from "./session-repository";

const sessionIdSchema = z.uuid();

export interface EnsureAnonymousSessionInput {
  existingSessionId?: string;
}

export interface EnsureAnonymousSessionResult {
  session: AnonymousSessionAggregate;
  created: boolean;
}

export async function ensureAnonymousSession(
  input: EnsureAnonymousSessionInput,
  repository: AnonymousSessionRepository,
): Promise<EnsureAnonymousSessionResult> {
  const parsedSessionId = sessionIdSchema.safeParse(input.existingSessionId);

  if (parsedSessionId.success) {
    const existing = await repository.findById(parsedSessionId.data);

    if (existing) {
      const session = existing.assessment
        ? existing
        : await repository.ensureAssessment(existing.id);

      return { session, created: false };
    }
  }

  const session = await repository.createWithAssessment();
  return { session, created: true };
}
