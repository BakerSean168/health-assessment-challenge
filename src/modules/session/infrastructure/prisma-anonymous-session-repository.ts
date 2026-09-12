import type {
  Prisma,
  PrismaClient,
} from "../../../generated/prisma/client";
import type { AnonymousSessionRepository } from "../application/session-repository";
import {
  FREE_SUBSCRIPTION_STATUS,
  type AnonymousSessionAggregate,
} from "../domain/session";

type SessionWithResources = Prisma.AnonymousSessionGetPayload<{
  include: { assessment: true; subscription: true };
}>;

function toDomainSession(session: SessionWithResources): AnonymousSessionAggregate;
function toDomainSession(session: null): null;
function toDomainSession(
  session: SessionWithResources | null,
): AnonymousSessionAggregate | null {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    // Missing subscription data is treated as FREE rather than accidentally
    // granting access. Normal application writes always create the 1:1 row.
    subscriptionStatus: session.subscription?.status ?? FREE_SUBSCRIPTION_STATUS,
    assessment: session.assessment
      ? {
          id: session.assessment.id,
          status: session.assessment.status,
          revision: session.assessment.revision,
          answers: {
            gender: session.assessment.gender,
            goal: session.assessment.goal,
            activityLevel: session.assessment.activityLevel,
            heightCm: session.assessment.heightCm,
            weightKg: session.assessment.weightKg,
            age: session.assessment.age,
            targetWeightKg: session.assessment.targetWeightKg,
          },
        }
      : null,
  };
}

export class PrismaAnonymousSessionRepository
  implements AnonymousSessionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<AnonymousSessionAggregate | null> {
    const session = await this.loadById(id);
    return session ? toDomainSession(session) : null;
  }

  async createWithAssessment(): Promise<AnonymousSessionAggregate> {
    const created = await this.prisma.anonymousSession.create({
      data: {
        assessment: { create: {} },
        subscription: { create: {} },
      },
      include: { assessment: true, subscription: true },
    });

    return toDomainSession(created);
  }

  async ensureResources(sessionId: string): Promise<AnonymousSessionAggregate> {
    await this.prisma.$transaction([
      this.prisma.assessment.createMany({
        data: { sessionId },
        skipDuplicates: true,
      }),
      this.prisma.subscription.createMany({
        data: { sessionId },
        skipDuplicates: true,
      }),
    ]);

    const session = await this.loadById(sessionId);

    if (!session) {
      throw new Error("Anonymous session disappeared while ensuring session resources.");
    }

    return toDomainSession(session);
  }

  private loadById(id: string) {
    return this.prisma.anonymousSession.findUnique({
      where: { id },
      include: { assessment: true, subscription: true },
    });
  }
}
