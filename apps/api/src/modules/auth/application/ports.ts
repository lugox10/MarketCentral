import type { UserStatus, UserRole } from '@prisma/client';

/** Proyección de usuario que consume la capa de aplicación (sin detalles de Prisma). */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  markEmailVerified(userId: string): Promise<void>;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface CreateSessionInput {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  ipHash: string | null;
  userAgent: string | null;
}

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<SessionRecord>;
  findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null>;
  revoke(sessionId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export interface TokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface TokenRepository {
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<TokenRecord>;
  findActiveByTokenHash(tokenHash: string): Promise<TokenRecord | null>;
  markUsed(tokenId: string): Promise<void>;
  invalidateAllForUser(userId: string): Promise<void>;
}

/** Puerto de salida de correo: la implementación concreta es intercambiable. */
export interface MailSender {
  sendVerificationEmail(input: { to: string; name: string; token: string }): Promise<void>;
  sendPasswordResetEmail(input: { to: string; name: string; token: string }): Promise<void>;
  sendSubscriptionExpiryEmail(input: {
    to: string;
    name: string;
    businessName: string;
    planName: string;
    daysLeft: number;
    endsAt: Date;
  }): Promise<void>;
}
