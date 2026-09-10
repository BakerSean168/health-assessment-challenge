import type { AnonymousSessionAggregate } from "../domain/session";

export interface AnonymousSessionRepository {
  findById(id: string): Promise<AnonymousSessionAggregate | null>;
  createWithAssessment(): Promise<AnonymousSessionAggregate>;
  ensureAssessment(sessionId: string): Promise<AnonymousSessionAggregate>;
}
