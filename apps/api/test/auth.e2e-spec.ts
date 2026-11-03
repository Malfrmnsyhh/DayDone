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
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertLocalDatabaseOnly } from './db-safety-guard.js';

describe('Auth & Session Management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fakeGoogleService: FakeGoogleOAuthService;

  beforeAll(async () => {
    assertLocalDatabaseOnly(process.env.DATABASE_URL!, process.env.DIRECT_URL);

    fakeGoogleService = new FakeGoogleOAuthService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_OAUTH_SERVICE)
      .useValue(fakeGoogleService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Bersihkan tabel
    await prisma.attachment.deleteMany();
    await prisma.logEntry.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.attachment.deleteMany();
      await prisma.logEntry.deleteMany();
      await prisma.session.deleteMany();
      await prisma.user.deleteMany();
    }
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/v1/auth/google', () => {
    it('login pertama kali menyimpan user dan mengenkripsi googleRefreshToken di DB (berawalan v1.)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({
          code: 'code-dev-a',
          platform: 'MOBILE',
        });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe('dev-a@daydone.local');
      expect(res.body.user.driveStatus).toBe('CONNECTED');

      // Verifikasi di database: googleRefreshToken tersimpan terenkripsi
      const dbUser = await prisma.user.findUnique({
        where: { email: 'dev-a@daydone.local' },
      });
      expect(dbUser?.googleRefreshToken).toBeDefined();
      expect(dbUser?.googleRefreshToken?.startsWith('v1.')).toBe(true);
      expect(dbUser?.googleRefreshToken).not.toBe('fake-refresh-token-a'); // bukan plaintext!
    });

    it('login ulang tanpa refresh token dari Google tidak menimpa/menghapus token terenkripsi yang sudah ada', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({
          code: 'code-dev-a-no-refresh',
          platform: 'MOBILE',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.driveStatus).toBe('CONNECTED');

      const dbUser = await prisma.user.findUnique({
        where: { email: 'dev-a@daydone.local' },
      });
      expect(dbUser?.googleRefreshToken?.startsWith('v1.')).toBe(true);
    });

    it('login dengan scope drive ditolak menghasilkan driveStatus NOT_CONNECTED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({
          code: 'code-dev-a-no-drive',
          platform: 'MOBILE',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.driveStatus).toBe('NOT_CONNECTED');
    });

    it('login dengan email unverified ditolak dengan 401 GOOGLE_AUTH_FAILED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({
          code: 'code-unverified-email',
          platform: 'MOBILE',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('GOOGLE_AUTH_FAILED');
    });

    it('platform WEB: refreshToken dikirim lewat cookie daydone_rt (HttpOnly; Path=/api/v1/auth) dan tidak di body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({
          code: 'code-dev-b',
          platform: 'WEB',
          redirectUri: 'postmessage',
        });

      expect(res.status).toBe(201);
      expect(res.body.refreshToken).toBeUndefined(); // tidak di body
      expect(res.body.accessToken).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const rtCookie = cookies.find((c: string) => c.startsWith('daydone_rt='));
      expect(rtCookie).toBeDefined();
      expect(rtCookie).toContain('HttpOnly');
      expect(rtCookie).toContain('Path=/api/v1/auth');
    });
  });

  describe('Rotasi Sesi & Deteksi Pemakaian Ulang (Token Reuse)', () => {
    let webCookie: string;
    let mobileRefreshToken: string;

    beforeAll(async () => {
      // Login Web untuk User B
      const webRes = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ code: 'code-dev-b', platform: 'WEB' });
      const cookieHeader = webRes.headers['set-cookie'][0];
      webCookie = cookieHeader.split(';')[0];

      // Login Mobile untuk User A
      const mobileRes = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ code: 'code-dev-a', platform: 'MOBILE' });
      mobileRefreshToken = mobileRes.body.refreshToken;
    });

    it('POST /api/v1/auth/refresh (Web): menolak 403 bila header X-Requested-With hilang', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [webCookie]);

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/auth/refresh (Web): berhasil merotasi cookie dan menerbitkan accessToken baru', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [webCookie])
        .set('X-Requested-With', 'daydone-web');

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeUndefined();

      // Perbarui cookie baru
      const newCookieHeader = res.headers['set-cookie'][0];
      const newWebCookie = newCookieHeader.split(';')[0];
      expect(newWebCookie).not.toBe(webCookie);
    });

    it('POST /api/v1/auth/refresh (Mobile): berhasil merotasi token dari body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: mobileRefreshToken });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.refreshToken).not.toBe(mobileRefreshToken);

      const rotatedToken = res.body.refreshToken;

      // Deteksi Reuse: Coba refresh sekali lagi dengan token LAMA (mobileRefreshToken)
      const reuseRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: mobileRefreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.code).toBe('SESSION_EXPIRED');

      // Bukti SEMUA sesi dicabut: token baru yang sah (rotatedToken) sekarang juga ditolak
      const afterReuseRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotatedToken });

      expect(afterReuseRes.status).toBe(401);
      expect(afterReuseRes.body.code).toBe('SESSION_EXPIRED');
    });
  });

  describe('Logout & GET /api/v1/auth/me', () => {
    let logoutCookie: string;
    let userAccessToken: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ code: 'code-dev-b', platform: 'WEB' });
      logoutCookie = loginRes.headers['set-cookie'][0].split(';')[0];
      userAccessToken = loginRes.body.accessToken;
    });

    it('GET /api/v1/auth/me tanpa token mengembalikan 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/auth/me dengan token valid mengembalikan profil pengguna (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('dev-b@daydone.local');
    });

    it('POST /api/v1/auth/logout (Web): menolak 403 bila header X-Requested-With hilang', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', [logoutCookie]);

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/auth/logout (Web): berhasil mencabut sesi dan membersihkan cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', [logoutCookie])
        .set('X-Requested-With', 'daydone-web');

      expect(res.status).toBe(204);

      // Verifikasi cookie dibersihkan (Max-Age=0 atau Expires lampau)
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toContain('daydone_rt=;');

      // Verifikasi access token dari sesi tersebut langsung tidak bisa dipakai lagi (401)
      const meRes = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userAccessToken}`);
      expect(meRes.status).toBe(401);
    });
  });
});
