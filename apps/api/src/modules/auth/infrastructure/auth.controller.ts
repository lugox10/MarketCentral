import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { LoginUseCase as Login } from '../application/login.use-case.js';
import {
  GetCurrentUserUseCase as GetMe,
  LogoutUseCase as Logout,
} from '../application/session.use-cases.js';
import { RegisterUseCase as Register } from '../application/register.use-case.js';
import {
  ResendVerificationUseCase as Resend,
  VerifyEmailUseCase as VerifyEmail,
} from '../application/email.use-cases.js';
import {
  RequestPasswordResetUseCase as Forgot,
  ResetPasswordUseCase as Reset,
} from '../application/password.use-cases.js';
import { AuthExceptionFilter } from './auth-exception.filter.js';
import {
  EmailOnlyDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from '../application/dto.js';
import { hashIp } from '../domain/session-token.js';
import { SESSION_TTL_MS } from '../domain/session-token.js';
import {
  type AuthenticatedActor,
  type AuthenticatedRequest,
  CurrentActor,
  SESSION_COOKIE,
  SessionGuard,
} from './session.guard.js';

const COOKIE_MAX_AGE_MS = SESSION_TTL_MS;

@ApiTags('auth')
@Controller('auth')
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(
    @Inject(Register) private readonly register: Register,
    @Inject(Login) private readonly login: Login,
    @Inject(Logout) private readonly logout: Logout,
    @Inject(GetMe) private readonly getMe: GetMe,
    @Inject(VerifyEmail) private readonly verifyEmail: VerifyEmail,
    @Inject(Resend) private readonly resend: Resend,
    @Inject(Forgot) private readonly forgot: Forgot,
    @Inject(Reset) private readonly reset: Reset,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  private hashClientIp(request: AuthenticatedRequest): string | null {
    const secret = this.config.get<string>('IP_HASH_SECRET') ?? 'dev-ip-hash-secret';
    return hashIp(request.ip, secret);
  }

  private setSessionCookie(response: Response, token: string): void {
    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrar una cuenta' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ description: 'Cuenta creada; se envía verificación de correo' })
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos' })
  async registerUser(
    @Body() body: RegisterDto,
  ): Promise<{ id: string; email: string; name: string }> {
    return this.register.execute(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión (cookie HttpOnly)' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Sesión creada' })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  @ApiTooManyRequestsResponse({ description: 'Más de 5 intentos por minuto' })
  async loginUser(
    @Body() body: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: unknown; expiresAt: string }> {
    const result = await this.login.execute({
      email: body.email,
      password: body.password,
      ipHash: this.hashClientIp(request),
      userAgent: request.get('user-agent')?.slice(0, 400) ?? null,
    });
    this.setSessionCookie(response, result.token);
    return { user: result.user, expiresAt: result.expiresAt.toISOString() };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiOperation({ summary: 'Cerrar la sesión actual' })
  @ApiNoContentResponse({ description: 'Sesión revocada' })
  async logoutUser(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const sessionId = request.sessionId;
    if (!sessionId) throw new UnauthorizedException('Sesión no iniciada');
    await this.logout.execute(sessionId);
    response.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  @ApiOkResponse({ description: 'Perfil' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
  async me(@CurrentActor() actor: AuthenticatedActor): Promise<unknown> {
    return this.getMe.execute(actor.userId);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Verificar el correo con el token recibido' })
  @ApiBody({ type: TokenDto })
  @ApiNoContentResponse({ description: 'Correo verificado' })
  async verify(@Body() body: TokenDto): Promise<void> {
    await this.verifyEmail.execute(body.token);
  }

  @Post('verify-email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reenviar la verificación de correo' })
  @ApiBody({ type: EmailOnlyDto })
  @ApiNoContentResponse({ description: 'Solicitud aceptada (respuesta uniforme)' })
  async resendVerification(@Body() body: EmailOnlyDto): Promise<void> {
    await this.resend.execute(body.email);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Solicitar restablecimiento de contraseña' })
  @ApiBody({ type: EmailOnlyDto })
  async forgotPassword(@Body() body: EmailOnlyDto): Promise<void> {
    await this.forgot.execute(body.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restablecer la contraseña y cerrar sesiones' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.reset.execute({ token: body.token, password: body.password });
  }
}
