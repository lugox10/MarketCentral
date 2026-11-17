import { Inject, Injectable } from '@nestjs/common';
import type { Session, User } from '@prisma/client';

import type {
  CreateSessionInput,
  CreateUserInput,
  SessionRecord,
  TokenRecord,
  UserRecord,
} from '../application/ports.js';
import type { SessionRepository, TokenRepository, UserRepository } from '../application/ports.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

function toUserRecord(user: User): UserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    name: user.name,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

function toSessionRecord(session: Session): SessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
  };
}

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user && user.deletedAt === null ? toUserRecord(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user && user.deletedAt === null ? toUserRecord(user) : null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
      },
    });
    return toUserRecord(user);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }
}

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    const session = await this.prisma.session.create({ data: input });
    return toSessionRecord(session);
  }

  async findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= now.getTime()) {
      return null;
    }
    return toSessionRecord(session);
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

@Injectable()
export class PrismaVerificationTokenRepository implements TokenRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<TokenRecord> {
    return this.prisma.emailVerificationToken.create({ data: input });
  }

  async findActiveByTokenHash(tokenHash: string): Promise<TokenRecord | null> {
    return this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  async markUsed(tokenId: string): Promise<void> {
    await this.prisma.emailVerificationToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}

@Injectable()
export class PrismaResetTokenRepository implements TokenRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<TokenRecord> {
    return this.prisma.passwordResetToken.create({ data: input });
  }

  async findActiveByTokenHash(tokenHash: string): Promise<TokenRecord | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async markUsed(tokenId: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
