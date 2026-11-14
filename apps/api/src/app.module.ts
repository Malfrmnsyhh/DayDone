import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard.js';
import { validateEnv } from './config/env.schema.js';
import { createPinoHttpConfig } from './config/logger.config.js';
import { HealthModule } from './health/health.module.js';
import { LogsModule } from './logs/logs.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { UsersModule } from './users/users.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const hasObserveKeys = Boolean(
  process.env.OBSERVE_APP_KEY?.trim() && process.env.OBSERVE_APP_SECRET?.trim(),
);

const observeImports = hasObserveKeys
  ? [
      ObserveModule.forRoot({
        appKey: process.env.OBSERVE_APP_KEY!.trim(),
        appSecret: process.env.OBSERVE_APP_SECRET!.trim(),
        serviceId: 'api',
      }),
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: createPinoHttpConfig(config),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    CryptoModule,
    AuthModule,
    ...observeImports,
    HealthModule,
    LogsModule,
    StorageModule,
    AttachmentsModule,
    UsersModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
  ],
})
export class AppModule {}
