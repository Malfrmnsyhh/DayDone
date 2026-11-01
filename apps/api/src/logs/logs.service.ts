import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateLogDto,
  ListLogsQuery,
  UpdateLogDto,
} from './dto/log.schema.js';
import type { LogEntry } from './log-entry.js';

@Injectable()
export class LogsService {
  private logs: LogEntry[] = [];

  findAll(query: ListLogsQuery): LogEntry[] {
    return this.logs
      .filter((log) => !query.from || log.date >= query.from)
      .filter((log) => !query.to || log.date <= query.to)
      .sort((a, b) => b.date.localeCompare(a.date)); // terbaru di atas
  }

  findOne(id: string): LogEntry {
    const log = this.logs.find((item) => item.id === id);
    if (!log) {
      throw new NotFoundException(`Logbook dengan id ${id} tidak ditemukan`);
    }
    return log;
  }

  create(dto: CreateLogDto): LogEntry {
    this.ensureDateAvailable(dto.date);

    const now = new Date().toISOString();
    const log: LogEntry = {
      id: randomUUID(),
      ...dto,
      createdAt: now,
      updatedAt: now,
    };
    this.logs.push(log);
    return log;
  }

  update(id: string, dto: UpdateLogDto): LogEntry {
    const log = this.findOne(id);

    if (dto.date && dto.date !== log.date) {
      this.ensureDateAvailable(dto.date);
    }

    Object.assign(log, dto, { updatedAt: new Date().toISOString() });
    return log;
  }

  remove(id: string): void {
    this.findOne(id); // lempar 404 kalau tidak ada
    this.logs = this.logs.filter((item) => item.id !== id);
  }

  private ensureDateAvailable(date: string): void {
    if (this.logs.some((item) => item.date === date)) {
      throw new ConflictException(`Logbook untuk tanggal ${date} sudah ada`);
    }
  }
}