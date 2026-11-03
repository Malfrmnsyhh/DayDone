import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
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

describe('Throttler Rate Limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    assertLocalDatabaseOnly(process.env.DATABASE_URL!, process.env.DIRECT_URL);

    // Aktifkan throttler secara eksplisit untuk test suite ini
    process.env.THROTTLER_FORCE_ENABLED = 'true';

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
    await app.init();
  });

  afterAll(async () => {
    process.env.THROTTLER_FORCE_ENABLED = 'false';
    if (app) {
      await app.close();
    }
  });

  it('request ke-11 ke /auth/google dalam satu menit dibalas 429 Too Many Requests', async () => {
    // Jalankan 10 request pertama (batas limit: 10 per menit)
    for (let i = 1; i <= 10; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({
          code: 'code-dev-a',
          platform: 'MOBILE',
        });
      expect(res.status).not.toBe(429);
    }

    // Request ke-11 harus dibalas 429 Too Many Requests
    const limitedRes = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        code: 'code-dev-a',
        platform: 'MOBILE',
      });

    expect(limitedRes.status).toBe(429);
  });
});

