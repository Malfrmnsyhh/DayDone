import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionsService } from '../sessions/sessions.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockReflector: {
    getAllAndOverride: ReturnType<typeof vi.fn>;
  };
  let mockJwtService: {
    verifyAsync: ReturnType<typeof vi.fn>;
  };
  let mockSessionsService: {
    validateSession: ReturnType<typeof vi.fn>;
  };

  const mockContext = (headers: Record<string, string> = {}) => {
    const request = {
      headers,
      user: undefined,
    };
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    };

    mockJwtService = {
      verifyAsync: vi.fn(),
    };

    mockSessionsService = {
      validateSession: vi.fn(),
    };

    guard = new JwtAuthGuard(
      mockReflector as unknown as Reflector,
      mockJwtService as unknown as JwtService,
      mockSessionsService as unknown as SessionsService,
    );
  });

  it('mengizinkan request jika endpoint bertanda @Public()', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);

    const context = mockContext();
    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
  });

  it('menolak bila header Authorization tidak ada atau tidak diawali Bearer', async () => {
    const context = mockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('menolak bila verifikasi JWT gagal (expired/invalid)', async () => {
    mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = mockContext({ authorization: 'Bearer invalid.token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('menolak bila sesi di database sudah tidak aktif (revoked/expired)', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
    });
    mockSessionsService.validateSession.mockResolvedValue(null);

    const context = mockContext({ authorization: 'Bearer valid.jwt' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('berhasil memvalidasi dan melampirkan user ke request', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
    });
    mockSessionsService.validateSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
    } as any);

    const context = mockContext({ authorization: 'Bearer valid.jwt' });
    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.user).toEqual({
      userId: 'user-1',
      sessionId: 'session-1',
    });
  });
});
