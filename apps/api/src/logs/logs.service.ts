import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { toDbDate } from '../common/date.js';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateLogDto,
  ListLogsQuery,
  UpdateLogDto,
} from './dto/log.schema.js';
import {
  toLogListItemResponse,
  toLogResponse,
  type LogResponse,
  type PaginatedLogsResponse,
} from './logs.mapper.js';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    query: ListLogsQuery,
  ): Promise<PaginatedLogsResponse> {
    const where: Prisma.LogEntryWhereInput = {
      userId,
    };

    if (query.from || query.to) {
      where.date = {};
      if (query.from) {
        where.date.gte = toDbDate(query.from);
      }
      if (query.to) {
        where.date.lte = toDbDate(query.to);
      }
    }

    if (query.search) {
      where.description = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, logs] = await this.prisma.$transaction([
      this.prisma.logEntry.count({ where }),
      this.prisma.logEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          attachments: {
            orderBy: { position: 'asc' },
            take: 1,
          },
          _count: {
            select: { attachments: true },
          },
        },
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: logs.map(toLogListItemResponse),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findOne(userId: string, id: string): Promise<LogResponse> {
    const log = await this.prisma.logEntry.findFirst({
      where: { id, userId },
      include: {
        attachments: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!log) {
      throw new NotFoundException(`Logbook dengan id ${id} tidak ditemukan`);
    }

    return toLogResponse(log);
  }

  async findByDate(userId: string, date: string): Promise<LogResponse> {
    const dbDate = toDbDate(date);
    const log = await this.prisma.logEntry.findUnique({
      where: {
        userId_date: {
          userId,
          date: dbDate,
        },
      },
      include: {
        attachments: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!log) {
      throw new NotFoundException(
        `Logbook untuk tanggal ${date} tidak ditemukan`,
      );
    }

    return toLogResponse(log);
  }

  async create(userId: string, dto: CreateLogDto): Promise<LogResponse> {
    const dbDate = toDbDate(dto.date);

    try {
      const log = await this.prisma.logEntry.create({
        data: {
          userId,
          date: dbDate,
          description: dto.description,
        },
        include: {
          attachments: {
            orderBy: { position: 'asc' },
          },
        },
      });

      return toLogResponse(log);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.logEntry.findFirst({
          where: { userId, date: dbDate },
          select: { id: true },
        });

        throw new DomainException(
          HttpStatus.CONFLICT,
          `Logbook untuk tanggal ${dto.date} sudah ada`,
          ErrorCode.LOG_DATE_CONFLICT,
          { existingLogId: existing?.id },
        );
      }
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateLogDto,
  ): Promise<LogResponse> {
    // Pastikan logbook ada dan milik pengguna (lempar 404 jika bukan)
    await this.findOne(userId, id);

    const dbDate = dto.date ? toDbDate(dto.date) : undefined;

    try {
      const updated = await this.prisma.logEntry.update({
        where: { id },
        data: {
          date: dbDate,
          description: dto.description,
        },
        include: {
          attachments: {
            orderBy: { position: 'asc' },
          },
        },
      });

      return toLogResponse(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.logEntry.findFirst({
          where: { userId, date: dbDate },
          select: { id: true },
        });

        throw new DomainException(
          HttpStatus.CONFLICT,
          `Logbook untuk tanggal ${dto.date} sudah ada`,
          ErrorCode.LOG_DATE_CONFLICT,
          { existingLogId: existing?.id },
        );
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    // Pastikan logbook ada dan milik pengguna (lempar 404 jika bukan)
    await this.findOne(userId, id);

    await this.prisma.logEntry.delete({
      where: { id },
    });
  }
}
