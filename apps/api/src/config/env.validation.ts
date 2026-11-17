import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsString, Max, Min, validateSync } from 'class-validator';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

/**
 * Contrato de variables de entorno de la API.
 *
 * Se valida al arrancar (fail-fast): si falta o es inválida una variable, el
 * proceso termina con un mensaje explícito en lugar de fallar más tarde.
 */
export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL es obligatoria' })
  DATABASE_URL!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT: number = 3001;

  @IsEnum(NODE_ENVS, { message: `NODE_ENV debe ser uno de: ${NODE_ENVS.join(', ')}` })
  NODE_ENV: NodeEnv = 'development';

  /** Lista separada por comas. Sin comodines en producción. */
  @IsString()
  @IsNotEmpty({ message: 'CORS_ORIGINS es obligatoria' })
  CORS_ORIGINS: string = 'http://localhost:3000';
}

export type ValidatedEnvironment = EnvironmentVariables;

export function validateEnv(raw: Record<string, unknown>): ValidatedEnvironment {
  const parsed = plainToInstance(
    EnvironmentVariables,
    { ...raw, API_PORT: raw.API_PORT === undefined ? undefined : Number(raw.API_PORT) },
    { enableImplicitConversion: false },
  );

  const errors = validateSync(parsed, { skipMissingProperties: false, forbidUnknownValues: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join('; '))
      .filter(Boolean)
      .join(' | ');
    throw new Error(`Configuración de entorno inválida: ${details}`);
  }

  if (
    parsed.NODE_ENV === 'production' &&
    parsed.CORS_ORIGINS.split(',').some((o) => o.trim() === '*')
  ) {
    throw new Error('CORS_ORIGINS no puede incluir "*" en producción');
  }

  return parsed;
}
