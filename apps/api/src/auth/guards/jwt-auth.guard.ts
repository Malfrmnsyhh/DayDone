import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { SessionsService } from '../sessions/sessions.service.js';

interface JwtPayload {
  sub: string;
  sid: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Lewati pemeriksaan jika endpoint ditandai @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Header Authorization: Bearer <token> wajib disertakan',
      );
    }

    const token = authHeader.slice(7);

    // 2. Verifikasi JWT access token dengan algoritma HS256 secara eksplisit
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException(
        'Token akses tidak valid atau telah kedaluwarsa',
      );
    }

    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException('Klaim token akses tidak lengkap');
    }

    // 3. Verifikasi status sesi di database dan kepemilikan user
    const session = await this.sessionsService.validateSession(payload.sid);
    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException(
        'Sesi tidak valid, telah dicabut, atau pengguna sudah tidak ada',
      );
    }

    // 4. Pasang user ke request untuk decorator @CurrentUser()
    (request as any).user = {
      userId: session.userId,
      sessionId: session.id,
    };

    return true;
  }
}

