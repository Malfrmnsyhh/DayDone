import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertLocalDatabaseOnly } from './db-safety-guard.js';

describe('Logs & Auth Isolation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    // 1. Guard keselamatan database: WAJIB localhost, larang keras Supabase
    assertLocalDatabaseOnly(process.env.DATABASE_URL!, process.env.DIRECT_URL);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // 2. Bersihkan tabel di DB lokal sebelum tes
    await prisma.attachment.deleteMany();
    await prisma.logEntry.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    // 3. Buat user dev-a dan dev-b
    await prisma.user.createMany({
      data: [
        {
          email: 'dev-a@daydone.local',
          googleId: 'google-dev-a',
          name: 'Dev A',
        },
        {
          email: 'dev-b@daydone.local',
          googleId: 'google-dev-b',
          name: 'Dev B',
        },
      ],
    });
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

  describe('Autentikasi DevAuthGuard', () => {
    it('GET /api/v1/health tanpa header mengembalikan 200 (endpoint publik)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /api/v1/logs tanpa header X-Dev-User-Email mengembalikan 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/logs');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/logs dengan email yang tidak terdaftar mengembalikan 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/logs')
        .set('X-Dev-User-Email', 'unknown@daydone.local');
      expect(res.status).toBe(401);
    });
  });

  describe('CRUD Logs & Isolasi Antar Pengguna', () => {
    let logAId: string;
    let logAId2: string;

    it('POST /api/v1/logs menolak tanggal lebih dari 1 hari di masa depan dengan 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('X-Dev-User-Email', 'dev-a@daydone.local')
        .send({
          date: '2099-01-01',
          description: 'Logbook masa depan',
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain(
        'lebih dari 1 hari setelah tanggal server',
      );
    });

    it('POST /api/v1/logs: User A membuat logbook berhasil (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('X-Dev-User-Email', 'dev-a@daydone.local')
        .send({
          date: '2026-11-01',
          description: 'Hari pertama magang Dev A - setup NestJS',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.date).toBe('2026-11-01');
      expect(res.body.description).toBe(
        'Hari pertama magang Dev A - setup NestJS',
      );
      expect(res.body.attachments).toEqual([]);
      expect(res.body.userId).toBeUndefined(); // tidak membocorkan userId
      logAId = res.body.id;
    });

    it('POST /api/v1/logs: User A duplikat tanggal yang sama menghasilkan 409 LOG_DATE_CONFLICT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('X-Dev-User-Email', 'dev-a@daydone.local')
        .send({
          date: '2026-11-01',
          description: 'Duplikat hari pertama',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('LOG_DATE_CONFLICT');
      expect(res.body.existingLogId).toBe(logAId);
    });

    it('POST /api/v1/logs: User A membuat log kedua pada tanggal berbeda', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('X-Dev-User-Email', 'dev-a@daydone.local')
        .send({
          date: '2026-11-02',
          description: 'Hari kedua magang Dev A - implementasi Prisma',
        });

      expect(res.status).toBe(201);
      logAId2 = res.body.id;
    });

    it('PATCH /api/v1/logs/:id: User A mengganti tanggal ke tanggal yang sudah ada menghasilkan 409 LOG_DATE_CONFLICT', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/logs/${logAId2}`)
        .set('X-Dev-User-Email', 'dev-a@daydone.local')
        .send({
          date: '2026-11-01',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('LOG_DATE_CONFLICT');
      expect(res.body.existingLogId).toBe(logAId);
    });

    it('POST /api/v1/logs: User B membuat logbook di tanggal yang sama BERHASIL (isolasi antar user)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('X-Dev-User-Email', 'dev-b@daydone.local')
        .send({
          date: '2026-11-01',
          description: 'Hari pertama magang Dev B',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).not.toBe(logAId);
      expect(res.body.date).toBe('2026-11-01');
    });

    it('GET /api/v1/logs/:id: User B mengakses log milik User A menghasilkan 404 (bukan 403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/logs/${logAId}`)
        .set('X-Dev-User-Email', 'dev-b@daydone.local');

      expect(res.status).toBe(404);
    });

    it('PATCH /api/v1/logs/:id: User B mengupdate log milik User A menghasilkan 404', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/logs/${logAId}`)
        .set('X-Dev-User-Email', 'dev-b@daydone.local')
        .send({ description: 'Hacking User A' });

      expect(res.status).toBe(404);
    });

    it('DELETE /api/v1/logs/:id: User B menghapus log milik User A menghasilkan 404', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/logs/${logAId}`)
        .set('X-Dev-User-Email', 'dev-b@daydone.local');

      expect(res.status).toBe(404);
    });

    it('GET /api/v1/logs/by-date/:date: User A mendapatkan log miliknya', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/logs/by-date/2026-11-01')
        .set('X-Dev-User-Email', 'dev-a@daydone.local');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(logAId);
      expect(res.body.description).toContain('Hari pertama magang Dev A');
    });

    it('GET /api/v1/logs: User A hanya melihat 2 log miliknya terpaginasi urut tanggal desc', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/logs')
        .set('X-Dev-User-Email', 'dev-a@daydone.local');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].id).toBe(logAId2); // 2026-11-02 lebih baru
      expect(res.body.data[1].id).toBe(logAId); // 2026-11-01
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.totalPages).toBe(1);
    });

    it('GET /api/v1/logs: filter search case-insensitive', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/logs?search=prisma')
        .set('X-Dev-User-Email', 'dev-a@daydone.local');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(logAId2);
      expect(res.body.meta.total).toBe(1);
    });

    it('GET /api/v1/logs: filter from dan to', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/logs?from=2026-11-02&to=2026-11-02')
        .set('X-Dev-User-Email', 'dev-a@daydone.local');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(logAId2);
    });

    it('GET /api/v1/logs: menolak query from > to dengan 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/logs?from=2026-11-05&to=2026-11-01')
        .set('X-Dev-User-Email', 'dev-a@daydone.local');

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain(
        'Tanggal from harus lebih kecil atau sama dengan to',
      );
    });

    it('PATCH /api/v1/logs/:id: User A berhasil mengupdate log miliknya', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/logs/${logAId}`)
        .set('X-Dev-User-Email', 'dev-a@daydone.local')
        .send({ description: 'Update deskripsi oleh Dev A' });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Update deskripsi oleh Dev A');
    });

    it('DELETE /api/v1/logs/:id: User A berhasil menghapus log miliknya (204)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/logs/${logAId}`)
        .set('X-Dev-User-Email', 'dev-a@daydone.local');

      expect(res.status).toBe(204);

      // Verifikasi log sudah tidak ada (404)
      const checkRes = await request(app.getHttpServer())
        .get(`/api/v1/logs/${logAId}`)
        .set('X-Dev-User-Email', 'dev-a@daydone.local');
      expect(checkRes.status).toBe(404);
    });
  });
});
