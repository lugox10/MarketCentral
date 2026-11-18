import 'reflect-metadata';

import { mkdir } from 'node:fs/promises';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';

import { AppModule } from './app.module.js';
import { resolveMediaDir } from './modules/listings/infrastructure/local-media-storage.js';

const API_VERSION = '0.1.0';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('API_PORT');
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
    maxAge: 600,
  });

  app.enableShutdownHooks();

  // Cookies HttpOnly firmadas por el navegador: el token nunca llega a JS.
  app.use(cookieParser());

  // Con almacenamiento S3/R2 las imágenes las sirve el proveedor. En desarrollo
  // el adaptador local escribe en disco y el propio API publica /media.
  if (!config.get<string>('MEDIA_S3_BUCKET')) {
    const mediaDir = resolveMediaDir(config.get<string>('MEDIA_LOCAL_DIR'));
    await mkdir(mediaDir, { recursive: true });
    app.use('/media', express.static(mediaDir, { maxAge: '1h', index: false, dotfiles: 'deny' }));
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
      'Contrato REST del backend. En el bootstrap solo expone health; los módulos de negocio se documentan a partir del Prompt 04.',
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
  // Fallo de arranque: no hay logger de Nest disponible todavía.
  process.stderr.write(`[api] error fatal al arrancar: ${String(error)}\n`);
  process.exitCode = 1;
});
