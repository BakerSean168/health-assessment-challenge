import type {
  Prisma,
  PrismaClient,
} from "../../../generated/prisma/client";
import type { AnonymousSessionRepository } from "../application/session-repository";
import type { AnonymousSessionAggregate } from "../domain/session";

type SessionWithAssessment = Prisma.AnonymousSessionGetPayload<{
  include: { assessment: true };
}>;

function toDomainSession(
  session: SessionWithAssessment | null,
): AnonymousSessionAggregate | null {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    subscriptionStatus: session.subscriptionStatus,
    assessment: session.assessment
      ? {
          id: session.assessment.id,
          status: session.assessment.status,
          revision: session.assessment.revision,
          gender: session.assessment.gender,
          goal: session.assessment.goal,
          activityLevel: session.assessment.activityLevel,
          heightCm: session.assessment.heightCm,
          weightKg: session.assessment.weightKg,
          age: session.assessment.age,
          targetWeightKg: session.assessment.targetWeightKg,
        }
      : null,
  };
}

export class PrismaAnonymousSessionRepository
  implements AnonymousSessionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<AnonymousSessionAggregate | null> {
    return toDomainSession(await this.loadById(id));
  }

  async createWithAssessment(): Promise<AnonymousSessionAggregate> {
    const created = await this.prisma.anonymousSession.create({
      data: {
        assessment: {
          create: {},
        },
      },
      include: { assessment: true },
    });

    return toDomainSession(created)!;
  }

  async ensureAssessment(sessionId: string): Promise<AnonymousSessionAggregate> {
    await this.prisma.assessment.upsert({
      where: { sessionId },
      update: {},
      create: { sessionId },
    });

    const session = await this.loadById(sessionId);

    if (!session) {
      throw new Error("Anonymous session disappeared while ensuring assessment.");
    }

    return toDomainSession(session)!;
  }

  private loadById(id: string) {
    return this.prisma.anonymousSession.findUnique({
      where: { id },
      include: { assessment: true },
    });
  }
}
