import type { AnonymousSessionAggregate } from "../domain/session";

export interface AnonymousSessionRepository {
  findById(id: string): Promise<AnonymousSessionAggregate | null>;
  createWithAssessment(): Promise<AnonymousSessionAggregate>;
  ensureResources(sessionId: string): Promise<AnonymousSessionAggregate>;
}
