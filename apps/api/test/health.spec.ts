import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // El test no usa CORS ni Swagger: solo comprueba el contrato del endpoint.
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 con { status: "ok" } y datos no sensibles', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok' });
    expect(typeof response.body.timestamp).toBe('string');
    expect(Number.isFinite(response.body.uptime)).toBe(true);
    expect(Object.keys(response.body).sort()).toEqual(['status', 'timestamp', 'uptime']);
  });
});
