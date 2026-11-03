import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const devAuthEnabled = this.configService.get<boolean>('DEV_AUTH_ENABLED');
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    // DevAuthGuard HANYA aktif bila DEV_AUTH_ENABLED=true dan bukan production
    const isGuardActive = devAuthEnabled && nodeEnv !== 'production';

    if (!isGuardActive) {
      throw new UnauthorizedException(
        'Autentikasi belum diaktifkan atau tidak tersedia untuk lingkungan ini',
      );
    }

    const request = context.switchToHttp().getRequest();
    const rawEmail = request.headers['x-dev-user-email'];

    if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.trim()) {
      throw new UnauthorizedException(
        'Header X-Dev-User-Email wajib diisi untuk autentikasi development',
      );
    }

    const email = rawEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException(
        `User development dengan email '${email}' tidak ditemukan di database`,
      );
    }

    request.user = {
      userId: user.id,
      email: user.email,
    };

    return true;
  }
}

