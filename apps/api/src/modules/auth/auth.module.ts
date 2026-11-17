import { Module } from '@nestjs/common';

import { GetCurrentUserUseCase, LogoutUseCase } from './application/session.use-cases.js';
import { LoginUseCase } from './application/login.use-case.js';
import { RegisterUseCase } from './application/register.use-case.js';
import { ResendVerificationUseCase, VerifyEmailUseCase } from './application/email.use-cases.js';
import {
  RequestPasswordResetUseCase,
  ResetPasswordUseCase,
} from './application/password.use-cases.js';
import {
  MAIL_SENDER,
  PASSWORD_HASHER,
  RESET_TOKEN_REPOSITORY,
  SESSION_REPOSITORY,
  USER_REPOSITORY,
  VERIFICATION_TOKEN_REPOSITORY,
} from './application/tokens.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import { AuthController } from './infrastructure/auth.controller.js';
import { ConsoleMailSender } from './infrastructure/console-mail-sender.js';
import {
  PrismaResetTokenRepository,
  PrismaSessionRepository,
  PrismaUserRepository,
  PrismaVerificationTokenRepository,
} from './infrastructure/prisma.repositories.js';
import { SessionGuard } from './infrastructure/session.guard.js';

/**
 * Módulo Auth (E1). Los adaptadores se enlazan a los puertos de la capa de
 * aplicación: cambiar Prisma, Argon2 o el correo no toca los casos de uso.
 */
@Module({
  controllers: [AuthController],
  providers: [
    RegisterUseCase,
    LoginUseCase,
    LogoutUseCase,
    GetCurrentUserUseCase,
    VerifyEmailUseCase,
    ResendVerificationUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    SessionGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: VERIFICATION_TOKEN_REPOSITORY, useClass: PrismaVerificationTokenRepository },
    { provide: RESET_TOKEN_REPOSITORY, useClass: PrismaResetTokenRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: MAIL_SENDER, useClass: ConsoleMailSender },
  ],
  exports: [USER_REPOSITORY, SESSION_REPOSITORY, SessionGuard],
})
export class AuthModule {}
