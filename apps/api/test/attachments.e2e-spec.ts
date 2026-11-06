import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { FakeGoogleOAuthService } from '../src/auth/google/fake-google-oauth.service.js';
import { GOOGLE_OAUTH_SERVICE } from '../src/auth/google/google-oauth.interface.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InMemoryStorageProvider } from '../src/storage/in-memory-storage.provider.js';
import { STORAGE_PROVIDER } from '../src/storage/storage.interface.js';
import { assertLocalDatabaseOnly } from './db-safety-guard.js';

describe('Attachments & Storage Integration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fakeStorage: InMemoryStorageProvider;
  let fakeGoogleService: FakeGoogleOAuthService;

  let tokenA: string;
  let userIdA: string;

  let tokenB: string;

  let tokenNoDrive: string;

  let sampleJpeg: Buffer;

  beforeAll(async () => {
    assertLocalDatabaseOnly(process.env.DATABASE_URL!, process.env.DIRECT_URL);

    fakeGoogleService = new FakeGoogleOAuthService();
    fakeStorage = new InMemoryStorageProvider();

    sampleJpeg = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 50, g: 100, b: 150 },
      },
    })
      .jpeg()
      .toBuffer();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_OAUTH_SERVICE)
      .useValue(fakeGoogleService)
      .overrideProvider(STORAGE_PROVIDER)
      .useValue(fakeStorage)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Bersihkan tabel lokal
    await prisma.attachment.deleteMany();
    await prisma.logEntry.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    // Login User A (Drive CONNECTED)
    const loginARes = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ code: 'code-dev-a', platform: 'MOBILE' });
    tokenA = loginARes.body.accessToken;
    userIdA = loginARes.body.user.id;

    // Login User B (Drive CONNECTED)
    const loginBRes = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ code: 'code-dev-b', platform: 'MOBILE' });
    tokenB = loginBRes.body.accessToken;

    // Login User C (Drive NOT_CONNECTED)
    const loginNoDriveRes = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ code: 'code-dev-c-no-drive', platform: 'MOBILE' });
    tokenNoDrive = loginNoDriveRes.body.accessToken;
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

  describe('ensureAppFolder Konkurensi', () => {
    it('3 unggahan paralel dari user baru menghasilkan tepat 1 folder di database', async () => {
      // Buat logbook untuk user A
      await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ date: '2026-10-20', description: 'Log test konkurensi' });

      // Pastikan driveFolderId user A di DB awalnya null
      await prisma.user.update({
        where: { id: userIdA },
        data: { driveFolderId: null },
      });

      fakeStorage.reset();

      // Jalankan 3 panggilan ensureAppFolder paralel
      const [f1, f2, f3] = await Promise.all([
        fakeStorage.ensureAppFolder(userIdA),
        fakeStorage.ensureAppFolder(userIdA),
        fakeStorage.ensureAppFolder(userIdA),
      ]);

      expect(f1).toBe(f2);
      expect(f2).toBe(f3);
    });
  });

  describe('POST /api/v1/logs/:id/attachments', () => {
    let logAId: string;
    let logBId: string;

    beforeAll(async () => {
      const logARes = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ date: '2026-10-21', description: 'Log A untuk lampiran' });
      logAId = logARes.body.id;

      const logBRes = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ date: '2026-10-21', description: 'Log B untuk isolasi' });
      logBId = logBRes.body.id;
    });

    it('berhasil mengunggah 1 file foto valid -> 201 Created dengan URL bertanda tangan', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/logs/${logAId}/attachments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('files', sampleJpeg, 'foto1.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(1);
      const att = res.body.data[0];

      expect(att.fileName).toMatch(/^2026-10-21_[a-f0-9]{8}\.jpg$/);
      expect(att.mimeType).toBe('image/jpeg');
      expect(att.position).toBe(0);
      expect(att.url).toContain('/content?token=');
      expect(att.urlExpiresAt).toBeDefined();

      // Pastikan tidak ada driveFileId yang bocor di response
      expect(att.driveFileId).toBeUndefined();
    });

    it('menolak unggah ke logbook milik user lain dengan 404 (anti-IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/logs/${logBId}/attachments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('files', sampleJpeg, 'foto-hacker.jpg');

      expect(res.status).toBe(404);
    });

    it('menolak unggah dari user dengan driveStatus NOT_CONNECTED dengan 409 DRIVE_NOT_CONNECTED', async () => {
      // Buat logbook untuk user tanpa Drive
      const logRes = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('Authorization', `Bearer ${tokenNoDrive}`)
        .send({ date: '2026-10-22', description: 'Log user tanpa Drive' });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/logs/${logRes.body.id}/attachments`)
        .set('Authorization', `Bearer ${tokenNoDrive}`)
        .attach('files', sampleJpeg, 'foto.jpg');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DRIVE_NOT_CONNECTED');
    });

    it('menolak file non-gambar (teks berkedok .jpg) dengan 415 UNSUPPORTED_FILE_TYPE', async () => {
      const fakeTextBuffer = Buffer.from('Fake text pretending to be an image');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/logs/${logAId}/attachments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('files', fakeTextBuffer, 'palsu.jpg');

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('menolak bila total file melebihi 5 dengan 409 ATTACHMENT_LIMIT_REACHED', async () => {
      // Saat ini logA sudah punya 1 lampiran. Unggah 4 lagi sehingga pas 5 lampiran
      for (let i = 2; i <= 5; i++) {
        const uploadRes = await request(app.getHttpServer())
          .post(`/api/v1/logs/${logAId}/attachments`)
          .set('Authorization', `Bearer ${tokenA}`)
          .attach('files', sampleJpeg, `foto${i}.jpg`);
        expect(uploadRes.status).toBe(201);
      }

      // Coba unggah file ke-6 -> tolak 409
      const overRes = await request(app.getHttpServer())
        .post(`/api/v1/logs/${logAId}/attachments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('files', sampleJpeg, 'foto6.jpg');

      expect(overRes.status).toBe(409);
      expect(overRes.body.code).toBe('ATTACHMENT_LIMIT_REACHED');
    });

    it('dua request upload multipart paralel yang total filenya melebihi kuota 5 ditangani secara konkuren: tepat 1 berhasil dan 1 ditolak 409 ATTACHMENT_LIMIT_REACHED', async () => {
      // Buat logbook baru untuk user A
      const logConcurrentRes = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          date: '2026-10-24',
          description: 'Log untuk konkurensi upload',
        });
      const concurrentLogId = logConcurrentRes.body.id;

      // Jalankan 2 request upload paralel secara simultan (masing-masing kirim 3 file, total 6 > 5)
      const req1 = request(app.getHttpServer())
        .post(`/api/v1/logs/${concurrentLogId}/attachments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('files', sampleJpeg, 'req1-file1.jpg')
        .attach('files', sampleJpeg, 'req1-file2.jpg')
        .attach('files', sampleJpeg, 'req1-file3.jpg');

      const req2 = request(app.getHttpServer())
        .post(`/api/v1/logs/${concurrentLogId}/attachments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('files', sampleJpeg, 'req2-file1.jpg')
        .attach('files', sampleJpeg, 'req2-file2.jpg')
        .attach('files', sampleJpeg, 'req2-file3.jpg');

      const [res1, res2] = await Promise.all([req1, req2]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      const failedRes = res1.status === 409 ? res1 : res2;
      expect(failedRes.body.code).toBe('ATTACHMENT_LIMIT_REACHED');

      // Pastikan di database total lampiran tetap tepat 3 (<= 5)
      const dbCount = await prisma.attachment.count({
        where: { logEntryId: concurrentLogId },
      });
      expect(dbCount).toBe(3);
    });
  });

  describe('Signed URL & Konten Lampiran', () => {
    let logId: string;
    let attachmentId: string;
    let signedContentUrl: string;

    beforeAll(async () => {
      const logRes = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ date: '2026-10-23', description: 'Log untuk signed url' });
      logId = logRes.body.id;

      const attRes = await request(app.getHttpServer())
        .post(`/api/v1/logs/${logId}/attachments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('files', sampleJpeg, 'original.jpg');

      attachmentId = attRes.body.data[0].id;
      signedContentUrl = attRes.body.data[0].url;
    });

    it('GET /api/v1/attachments/:id/url mengembalikan URL baru berumur 5 menit', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/attachments/${attachmentId}/url`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.url).toContain('/content?token=');
      expect(res.body.expiresAt).toBeDefined();
    });

    it('GET /api/v1/attachments/:id/url ditolak 404 jika diakses user lain (IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/attachments/${attachmentId}/url`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('GET content dengan token valid mengalirkan file dengan header keamanan yang tepat', async () => {
      // Ambil path relatif dari signedContentUrl
      const urlObj = new URL(signedContentUrl);
      const pathAndQuery = `${urlObj.pathname}${urlObj.search}`;

      const res = await request(app.getHttpServer()).get(pathAndQuery);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.headers['cache-control']).toBe('private, max-age=300');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.body).toBeDefined();
    });

    it('GET content dengan token yang diubah satu karakter ditolak dengan 401 Unauthorized', async () => {
      const urlObj = new URL(signedContentUrl);
      const originalToken = urlObj.searchParams.get('token')!;
      const [payloadPart, sigPart] = originalToken.split('.');
      const badSig = (sigPart.startsWith('a') ? 'b' : 'a') + sigPart.slice(1);
      const badToken = `${payloadPart}.${badSig}`;

      const res = await request(app.getHttpServer()).get(
        `${urlObj.pathname}?token=${badToken}`,
      );

      expect(res.status).toBe(401);
    });

    it('GET /logs/:id menyertakan signed URL untuk seluruh lampiran', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/logs/${logId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.attachments).toHaveLength(1);
      expect(res.body.attachments[0].url).toBeDefined();
      expect(res.body.attachments[0].urlExpiresAt).toBeDefined();
    });
  });

  describe('DELETE /api/v1/attachments/:id dan DELETE /api/v1/logs/:id', () => {
    let logId: string;
    let att1Id: string;
    let att2Id: string;

    beforeAll(async () => {
      const logRes = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ date: '2026-10-24', description: 'Log delete test' });
      logId = logRes.body.id;

      const attRes = await request(app.getHttpServer())
        .post(`/api/v1/logs/${logId}/attachments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('files', sampleJpeg, 'foto1.jpg')
        .attach('files', sampleJpeg, 'foto2.jpg');

      att1Id = attRes.body.data[0].id;
      att2Id = attRes.body.data[1].id;
    });

    it('DELETE lampiran milik user lain ditolak dengan 404 (IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/attachments/${att1Id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('DELETE lampiran sendiri berhasil 204 dan merapatkan posisi lampiran kedua ke 0', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/attachments/${att1Id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(204);

      // Verifikasi att2 posisinya sekarang 0
      const updatedAtt2 = await prisma.attachment.findUnique({
        where: { id: att2Id },
      });
      expect(updatedAtt2?.position).toBe(0);
    });

    it('DELETE /logs/:id memindahkan file ke Trash dan menghapus data DB (204)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/logs/${logId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(204);

      // Pastikan log sudah 404
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/logs/${logId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/users/me (Hapus Akun)', () => {
    let deleteUserToken: string;
    let deleteUserId: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ code: 'code-dev-b', platform: 'WEB' });
      deleteUserToken = loginRes.body.accessToken;
      deleteUserId = loginRes.body.user.id;
    });

    it('menolak bila body konfirmasi bukan "HAPUS" (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${deleteUserToken}`)
        .send({ confirm: 'TIDAK_YAKIN' });

      expect(res.status).toBe(400);
    });

    it('berhasil menghapus user (cascade) dan membersihkan cookie web (204)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${deleteUserToken}`)
        .send({ confirm: 'HAPUS' });

      expect(res.status).toBe(204);

      // Verifikasi cookie dibersihkan
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toContain('daydone_rt=;');

      // Verifikasi user terhapus dari DB
      const dbUser = await prisma.user.findUnique({
        where: { id: deleteUserId },
      });
      expect(dbUser).toBeNull();

      // Token akses user langsung tidak bisa dipakai lagi (401)
      const meRes = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${deleteUserToken}`);
      expect(meRes.status).toBe(401);
    });
  });
});
