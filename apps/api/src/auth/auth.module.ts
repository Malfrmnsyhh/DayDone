import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { StorageModule } from '../storage/storage.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GOOGLE_OAUTH_SERVICE } from './google/google-oauth.interface.js';
import { RealGoogleOAuthService } from './google/real-google-oauth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { SessionsService } from './sessions/sessions.service.js';

@Module({
  imports: [
    StorageModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') as any,
          algorithm: 'HS256',
        },
        verifyOptions: {
          algorithms: ['HS256'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    JwtAuthGuard,
    {
      provide: GOOGLE_OAUTH_SERVICE,
      useClass: RealGoogleOAuthService,
    },
  ],
  exports: [
    AuthService,
    SessionsService,
    JwtModule,
    JwtAuthGuard,
    GOOGLE_OAUTH_SERVICE,
  ],
})
export class AuthModule {}

