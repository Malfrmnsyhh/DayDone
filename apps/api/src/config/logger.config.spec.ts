import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pinoHttp from 'pino-http';
import { describe, expect, it, vi } from 'vitest';
import { createPinoHttpConfig } from './logger.config.js';

class MockResponse extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string | string[]> = {};

  readonly setHeader = vi.fn((name: string, value: string) => {
    this.headers[name.toLowerCase()] = value;
  });

  readonly getHeader = vi.fn((name: string) => {
    return this.headers[name.toLowerCase()];
  });

  readonly getHeaders = vi.fn(() => {
    return this.headers;
  });
}

describe('Logger Configuration & Redaction (createPinoHttpConfig)', () => {
  it('genReqId meneruskan X-Request-Id jika disediakan di header request', () => {
    const config = createPinoHttpConfig();
    const mockReq = {
      headers: { 'x-request-id': 'custom-req-trace-123' },
    } as unknown as IncomingMessage;
    const setHeaderSpy = vi.fn();
    const mockRes = {
      setHeader: setHeaderSpy,
    } as unknown as ServerResponse;

    const reqId = (config.genReqId as (req: IncomingMessage, res: ServerResponse) => string)(
      mockReq,
      mockRes,
    );

    expect(reqId).toBe('custom-req-trace-123');
    expect(setHeaderSpy).toHaveBeenCalledWith('X-Request-Id', 'custom-req-trace-123');
  });

  it('genReqId menghasilkan UUID v4 baru jika header X-Request-Id kosong', () => {
    const config = createPinoHttpConfig();
    const mockReq = {
      headers: {},
    } as unknown as IncomingMessage;
    const setHeaderSpy = vi.fn();
    const mockRes = {
      setHeader: setHeaderSpy,
    } as unknown as ServerResponse;

    const reqId = (config.genReqId as (req: IncomingMessage, res: ServerResponse) => string)(
      mockReq,
      mockRes,
    );

    expect(reqId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(setHeaderSpy).toHaveBeenCalledWith('X-Request-Id', reqId);
  });

  it('meredaksi header authorization, cookie, dan set-cookie dalam log', () => {
    const pinoConfig = createPinoHttpConfig();
    const logs: string[] = [];
    const stream = {
      write: (chunk: string) => {
        logs.push(chunk);
      },
    };

    const httpLogger = pinoHttp(
      {
        ...pinoConfig,
        level: 'info',
      },
      stream,
    );

    const mockReq = {
      id: 'req-test-1',
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: 'Bearer secret-jwt-access-token-123',
        cookie: 'daydone_rt=secret-refresh-cookie-xyz',
      },
      socket: { remoteAddress: '127.0.0.1' },
    };

    const mockRes = new MockResponse();
    mockRes.setHeader('set-cookie', 'daydone_rt=new-secret-cookie; HttpOnly');

    httpLogger(mockReq as unknown as IncomingMessage, mockRes as unknown as ServerResponse);
    httpLogger.logger.info({ req: mockReq, res: mockRes }, 'test request');

    const logOutput = logs.join('');

    // Pastikan token asli TIDAK PERNAH muncul di log
    expect(logOutput).not.toContain('secret-jwt-access-token-123');
    expect(logOutput).not.toContain('secret-refresh-cookie-xyz');
    expect(logOutput).not.toContain('new-secret-cookie');

    // Pastikan status [REDACTED] muncul
    expect(logOutput).toContain('[REDACTED]');
  });

  it('meredaksi payload sensitif body (code, refreshToken, confirm)', () => {
    const pinoConfig = createPinoHttpConfig();
    const logs: string[] = [];
    const stream = {
      write: (chunk: string) => {
        logs.push(chunk);
      },
    };

    const httpLogger = pinoHttp(
      {
        ...pinoConfig,
        level: 'info',
      },
      stream,
    );

    const mockReq = {
      id: 'req-test-2',
      method: 'POST',
      url: '/api/v1/auth/google',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      body: {
        code: 'google-oauth-super-secret-code',
        refreshToken: 'raw-refresh-token-session-secret',
        confirm: 'HAPUS',
        platform: 'WEB',
      },
    };

    const mockRes = new MockResponse();

    httpLogger(mockReq as unknown as IncomingMessage, mockRes as unknown as ServerResponse);
    httpLogger.logger.info({ req: mockReq }, 'test auth payload');

    const logOutput = logs.join('');

    // Pastikan nilai sensitif tidak bocor
    expect(logOutput).not.toContain('google-oauth-super-secret-code');
    expect(logOutput).not.toContain('raw-refresh-token-session-secret');
    expect(logOutput).not.toContain('"confirm":"HAPUS"');

    // Field non-sensitif tetap tercatat
    expect(logOutput).toContain('WEB');
    expect(logOutput).toContain('[REDACTED]');
  });

  it('meredaksi query parameter token HMAC pada URL lampiran', () => {
    const pinoConfig = createPinoHttpConfig();
    const logs: string[] = [];
    const stream = {
      write: (chunk: string) => {
        logs.push(chunk);
      },
    };

    const httpLogger = pinoHttp(
      {
        ...pinoConfig,
        level: 'info',
      },
      stream,
    );

    const mockReq = {
      id: 'req-test-3',
      method: 'GET',
      url: '/api/v1/attachments/a91d84f0/content?foo=bar&token=secret-hmac-signature-abc12345&extra=true',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    };

    const mockRes = new MockResponse();

    httpLogger(mockReq as unknown as IncomingMessage, mockRes as unknown as ServerResponse);
    httpLogger.logger.info({ req: mockReq }, 'test attachment url');

    const logOutput = logs.join('');

    // Pastikan token HMAC rahasia TIDAK muncul
    expect(logOutput).not.toContain('secret-hmac-signature-abc12345');

    // Pastikan parameter token diganti dengan [REDACTED] dan parameter lain tetap ada
    expect(logOutput).toContain('token=[REDACTED]');
    expect(logOutput).toContain('foo=bar');
    expect(logOutput).toContain('extra=true');
  });
});
