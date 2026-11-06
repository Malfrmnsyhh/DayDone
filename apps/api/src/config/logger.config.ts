import type { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import { stdSerializers } from 'pino-http';

export function createPinoHttpConfig(configService?: ConfigService): Options {
  const nodeEnv =
    configService?.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
  const isDev = nodeEnv === 'development';
  const isTest = nodeEnv === 'test';

  return {
    level: isTest ? 'silent' : isDev ? 'debug' : 'info',
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
          },
        }
      : undefined,
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && incoming.trim().length > 0
          ? incoming.trim()
          : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'req.body.code',
        'req.body.refreshToken',
        'req.body.confirm',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req: (request: IncomingMessage) => {
        const rawReq = (request as unknown as { raw?: { body?: unknown } }).raw;
        const body =
          rawReq?.body ?? (request as unknown as { body?: unknown }).body;
        const serialized = stdSerializers.req(request) as unknown as Record<
          string,
          unknown
        >;

        if (
          typeof serialized.url === 'string' &&
          serialized.url.includes('token=')
        ) {
          serialized.url = serialized.url.replace(
            /([?&]token=)[^&]+/g,
            '$1[REDACTED]',
          );
        }

        if (body !== undefined) {
          serialized.body = body;
        }

        return serialized;
      },
    },
  };
}
