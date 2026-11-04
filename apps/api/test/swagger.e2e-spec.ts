import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { FakeGoogleOAuthService } from '../src/auth/google/fake-google-oauth.service.js';
import { GOOGLE_OAUTH_SERVICE } from '../src/auth/google/google-oauth.interface.js';
import { InMemoryStorageProvider } from '../src/storage/in-memory-storage.provider.js';
import { STORAGE_PROVIDER } from '../src/storage/storage.interface.js';
import { assertLocalDatabaseOnly } from './db-safety-guard.js';

describe('Swagger OpenAPI Documentation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    assertLocalDatabaseOnly(process.env.DATABASE_URL!, process.env.DIRECT_URL);

    const fakeGoogleService = new FakeGoogleOAuthService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_OAUTH_SERVICE)
      .useValue(fakeGoogleService)
      .overrideProvider(STORAGE_PROVIDER)
      .useValue(new InMemoryStorageProvider())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new StandardSchemaValidationPipe());

    const config = new DocumentBuilder()
      .setTitle('DayDone API')
      .setDescription(
        'Spesifikasi REST API untuk DayDone - Logbook Harian Mahasiswa Magang',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'bearer',
      )
      .addCookieAuth(
        'daydone_rt',
        {
          type: 'apiKey',
          in: 'cookie',
        },
        'cookie',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
    });

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/docs mengembalikan 200 dan halaman HTML Swagger UI', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('GET /api/docs-json mengembalikan 200 dan spesifikasi OpenAPI JSON valid', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toBe('DayDone API');

    // Verifikasi skema auth
    expect(res.body.components.securitySchemes.bearer).toBeDefined();
    expect(res.body.components.securitySchemes.cookie).toBeDefined();

    // Verifikasi paths endpoint utama
    expect(res.body.paths['/api/v1/auth/google']).toBeDefined();
    expect(res.body.paths['/api/v1/auth/refresh']).toBeDefined();
    expect(res.body.paths['/api/v1/auth/logout']).toBeDefined();
    expect(res.body.paths['/api/v1/logs']).toBeDefined();
    expect(res.body.paths['/api/v1/logs/{id}/attachments']).toBeDefined();
    expect(res.body.paths['/api/v1/attachments/{id}/content']).toBeDefined();
    expect(res.body.paths['/api/v1/users/me']).toBeDefined();
    expect(res.body.paths['/api/v1/health']).toBeDefined();
  });
});
