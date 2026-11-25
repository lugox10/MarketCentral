import 'reflect-metadata';

import { mkdir } from 'node:fs/promises';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';

import { AppModule } from './app.module.js';
import { InternalErrorFilter } from './common/observability/internal-error.filter.js';
import { requestLogger } from './common/observability/request-logger.middleware.js';
import { resolveMediaDir } from './modules/listings/infrastructure/local-media-storage.js';

const API_VERSION = '0.1.0';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  // Render (y la mayoría de PaaS) inyecta `PORT`; en local se usa `API_PORT`.
  const port = config.get<number>('PORT') ?? config.getOrThrow<number>('API_PORT');
  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Orígenes explícitos desde entorno; nunca "*" en producción (ver env.validation).
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  app.enableShutdownHooks();

  // Cookies HttpOnly: el token de sesión nunca llega a JavaScript.
  app.use(requestLogger);
  app.use(cookieParser());
  app.useGlobalFilters(new InternalErrorFilter());

  // Con almacenamiento S3/R2 las imágenes las sirve el proveedor. En desarrollo
  // el adaptador local escribe en disco y el propio API publica /media.
  //
  // En un contenedor sin permisos sobre el directorio de trabajo (por ejemplo
  // Render ejecutando como usuario `node` sobre /app), preparar el disco puede
  // fallar. Eso no debe tumbar la API: se avisa y se sigue sirviendo el resto.
  if (!config.get<string>('MEDIA_S3_BUCKET')) {
    const mediaDir = resolveMediaDir(config.get<string>('MEDIA_LOCAL_DIR'));
    try {
      await mkdir(mediaDir, { recursive: true });
      app.use('/media', express.static(mediaDir, { maxAge: '1h', index: false, dotfiles: 'deny' }));
    } catch (error) {
      logger.warn(
        `No se pudo preparar el almacenamiento local de imágenes en "${mediaDir}" (${String(error)}). ` +
          'La API arranca igual, pero /media no se publicará: configura MEDIA_S3_BUCKET o un MEDIA_LOCAL_DIR escribible.',
      );
    }
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MarketCentral API')
    .setDescription(
      'Contrato REST del marketplace multi-vertical: identidad, negocios, taxonomía, publicaciones, catálogo público, leads, suscripciones y moderación.',
    )
    .setVersion(API_VERSION)
    .addServer(`http://localhost:${port}`, 'Local')
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`API escuchando en http://localhost:${port} (OpenAPI en /api/docs)`);
}

bootstrap().catch((error: unknown) => {
  // Fallo de arranque: todavía no hay logger de la aplicación disponible.
  process.stderr.write(`[api] error fatal al arrancar: ${String(error)}\n`);
  process.exitCode = 1;
});
