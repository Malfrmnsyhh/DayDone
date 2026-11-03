import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { DevAuthGuard } from './dev-auth.guard.js';

describe('DevAuthGuard', () => {
  let guard: DevAuthGuard;
  let reflector: Reflector;
  let configService: ConfigService;
  let prismaService: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    reflector = new Reflector();
    configService = new ConfigService();
    prismaService = {
      user: {
        findUnique: vi.fn(),
      },
    };

    guard = new DevAuthGuard(
      reflector,
      configService,
      prismaService as unknown as PrismaService,
    );
  });

  function createMockContext(headers: Record<string, string> = {}) {
    const request = {
      headers,
      user: undefined,
    };

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('harus mengizinkan rute publik (@Public)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockContext();

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);
  });

  it('harus melempar UnauthorizedException bila DEV_AUTH_ENABLED tidak aktif', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'DEV_AUTH_ENABLED') return false;
      if (key === 'NODE_ENV') return 'development';
      return null;
    });

    const context = createMockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('harus melempar UnauthorizedException bila header X-Dev-User-Email kosong', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'DEV_AUTH_ENABLED') return true;
      if (key === 'NODE_ENV') return 'development';
      return null;
    });

    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Header X-Dev-User-Email wajib diisi',
    );
  });

  it('harus melempar UnauthorizedException bila user tidak ditemukan di database', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'DEV_AUTH_ENABLED') return true;
      if (key === 'NODE_ENV') return 'development';
      return null;
    });

    prismaService.user.findUnique.mockResolvedValue(null);

    const context = createMockContext({
      'x-dev-user-email': 'notfound@daydone.local',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      'User development dengan email \'notfound@daydone.local\' tidak ditemukan',
    );
  });

  it('harus berhasil dan mengisi request.user bila user ditemukan', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'DEV_AUTH_ENABLED') return true;
      if (key === 'NODE_ENV') return 'development';
      return null;
    });

    prismaService.user.findUnique.mockResolvedValue({
      id: 'uuid-user-a',
      email: 'dev-a@daydone.local',
    });

    const context = createMockContext({
      'x-dev-user-email': 'dev-a@daydone.local',
    });

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);

    const req = context.switchToHttp().getRequest();
    expect(req.user).toEqual({
      userId: 'uuid-user-a',
      email: 'dev-a@daydone.local',
    });
  });
});

