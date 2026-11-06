import { type ArgumentsHost, HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let hostMock: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    hostMock = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: statusMock,
        }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('harus memetakan error P2002 ke 409 Conflict generik', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.10.1',
      },
    );

    filter.catch(error, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: 'Data sudah ada atau terjadi konflik duplikasi unik',
    });
  });

  it('harus memetakan error P2025 ke 404 Not Found', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Record to delete does not exist',
      {
        code: 'P2025',
        clientVersion: '7.10.1',
      },
    );

    filter.catch(error, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'Data tidak ditemukan',
    });
  });
});
