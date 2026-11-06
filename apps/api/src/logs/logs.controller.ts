import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import multer from 'multer';
import { AttachmentsService } from '../attachments/attachments.service.js';
import type { AttachmentResponse } from '../attachments/dto/attachment.types.js';
import {
  CurrentUser,
  type CurrentUserData,
} from '../common/decorators/current-user.decorator.js';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter.js';
import {
  createLogSchema,
  dateParamSchema,
  listLogsQuerySchema,
  updateLogSchema,
  type CreateLogDto,
  type DateParam,
  type ListLogsQuery,
  type UpdateLogDto,
} from './dto/log.schema.js';
import type { LogResponse, PaginatedLogsResponse } from './logs.mapper.js';
import { LogsService } from './logs.service.js';

@ApiTags('Logs')
@ApiBearerAuth('bearer')
@Controller('logs')
export class LogsController {
  constructor(
    private readonly logsService: LogsService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Mengambil daftar logbook terpaginasi milik user' })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2026-11-01',
    description: 'Tanggal awal (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2026-11-30',
    description: 'Tanggal akhir (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Pencarian substring pada deskripsi',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Halaman data (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Jumlah item per halaman (1-100, default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar logbook terpaginasi',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              date: { type: 'string', example: '2026-11-02' },
              description: { type: 'string' },
              attachments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    fileName: { type: 'string' },
                    mimeType: { type: 'string' },
                    sizeBytes: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                    position: { type: 'number' },
                    url: { type: 'string', nullable: true },
                    urlExpiresAt: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                    },
                  },
                },
              },
              attachmentCount: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Format tanggal atau query tidak valid',
  })
  @ApiResponse({ status: 401, description: 'Access token tidak valid' })
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query({ schema: listLogsQuerySchema }) query: ListLogsQuery,
  ): Promise<PaginatedLogsResponse> {
    return this.logsService.findAll(user.userId, query);
  }

  @Get('by-date/:date')
  @ApiOperation({
    summary: 'Mengecek atau mengambil logbook berdasarkan tanggal spesifik',
  })
  @ApiParam({ name: 'date', type: 'string', example: '2026-11-02' })
  @ApiResponse({ status: 200, description: 'Logbook ditemukan' })
  @ApiResponse({ status: 400, description: 'Format tanggal tidak valid' })
  @ApiResponse({ status: 401, description: 'Access token tidak valid' })
  @ApiResponse({
    status: 404,
    description: 'Logbook pada tanggal tersebut tidak ditemukan',
  })
  findByDate(
    @CurrentUser() user: CurrentUserData,
    @Param({ schema: dateParamSchema }) params: DateParam,
  ): Promise<LogResponse> {
    return this.logsService.findByDate(user.userId, params.date);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Mengambil detail lengkap satu logbook berdasarkan ID',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Detail logbook lengkap beserta lampirannya',
  })
  @ApiResponse({ status: 401, description: 'Access token tidak valid' })
  @ApiResponse({ status: 404, description: 'Logbook tidak ditemukan' })
  findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LogResponse> {
    return this.logsService.findOne(user.userId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Membuat entri logbook harian baru' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['date', 'description'],
      properties: {
        date: {
          type: 'string',
          example: '2026-11-02',
          description: 'Format YYYY-MM-DD',
        },
        description: {
          type: 'string',
          example: 'Menyiapkan project NestJS dan endpoint CRUD.',
          minLength: 1,
          maxLength: 5000,
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Logbook berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Validasi input gagal' })
  @ApiResponse({ status: 401, description: 'Access token tidak valid' })
  @ApiResponse({
    status: 409,
    description: 'Logbook untuk tanggal ini sudah ada (LOG_DATE_CONFLICT)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        error: { type: 'string', example: 'Conflict' },
        message: {
          type: 'string',
          example: 'Logbook untuk tanggal 2026-11-02 sudah ada',
        },
        code: { type: 'string', example: 'LOG_DATE_CONFLICT' },
        existingLogId: { type: 'string', format: 'uuid' },
      },
    },
  })
  create(
    @CurrentUser() user: CurrentUserData,
    @Body({ schema: createLogSchema }) dto: CreateLogDto,
  ): Promise<LogResponse> {
    return this.logsService.create(user.userId, dto);
  }

  @Post(':id/attachments')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mengunggah 1-5 lampiran foto untuk logbook' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Maks. 5 file, maks. 10MB per file (JPEG, PNG, WebP)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Lampiran berhasil diunggah' })
  @ApiResponse({ status: 400, description: 'Tidak ada file yang diunggah' })
  @ApiResponse({ status: 401, description: 'Access token tidak valid' })
  @ApiResponse({ status: 404, description: 'Logbook tidak ditemukan' })
  @ApiResponse({
    status: 409,
    description:
      'Batas 5 lampiran tercapai (ATTACHMENT_LIMIT_REACHED) atau izin Drive belum ada (DRIVE_NOT_CONNECTED / DRIVE_RECONNECT_REQUIRED)',
  })
  @ApiResponse({
    status: 413,
    description: 'Ukuran file melebihi 10MB (FILE_TOO_LARGE)',
  })
  @ApiResponse({
    status: 415,
    description: 'Format file tidak didukung (UNSUPPORTED_FILE_TYPE)',
  })
  @ApiResponse({
    status: 502,
    description: 'Google Drive sementara tidak tersedia (DRIVE_UNAVAILABLE)',
  })
  @ApiResponse({
    status: 507,
    description: 'Google Drive pengguna penuh (DRIVE_STORAGE_FULL)',
  })
  async uploadAttachments(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ data: AttachmentResponse[] }> {
    const data = await this.attachmentsService.uploadAttachments(
      user.userId,
      id,
      files,
    );
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Memperbarui tanggal atau deskripsi logbook' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        date: { type: 'string', example: '2026-11-03' },
        description: { type: 'string', minLength: 1, maxLength: 5000 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logbook berhasil diperbarui' })
  @ApiResponse({ status: 400, description: 'Validasi input gagal' })
  @ApiResponse({ status: 401, description: 'Access token tidak valid' })
  @ApiResponse({ status: 404, description: 'Logbook tidak ditemukan' })
  @ApiResponse({
    status: 409,
    description: 'Konflik tanggal dengan logbook lain (LOG_DATE_CONFLICT)',
  })
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateLogSchema }) dto: UpdateLogDto,
  ): Promise<LogResponse> {
    return this.logsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Menghapus logbook dan seluruh file lampirannya di Drive',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Logbook berhasil dihapus' })
  @ApiResponse({ status: 401, description: 'Access token tidak valid' })
  @ApiResponse({ status: 404, description: 'Logbook tidak ditemukan' })
  remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.logsService.remove(user.userId, id);
  }
}
