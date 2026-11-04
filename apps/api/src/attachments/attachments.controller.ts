import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import {
  CurrentUser,
  type CurrentUserData,
} from '../common/decorators/current-user.decorator.js';
import { AttachmentsService } from './attachments.service.js';
import type { AttachmentUrlResponse } from './dto/attachment.types.js';

@ApiTags('Attachments')
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * Menghasilkan signed URL sementara (5 menit) untuk lampiran tertentu.
   */
  @Get(':id/url')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Mendapatkan signed URL sementara (5 menit) untuk lampiran' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Signed URL berhasil dibuat',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Access token tidak valid' })
  @ApiResponse({ status: 404, description: 'Lampiran tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Google Drive perlu dihubungkan ulang (DRIVE_RECONNECT_REQUIRED)' })
  async getAttachmentUrl(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttachmentUrlResponse> {
    return this.attachmentsService.getAttachmentUrl(user.userId, id);
  }

  /**
   * Endpoint publik yang dilindungi signed URL token untuk mengalirkan file gambar dari Drive.
   */
  @Public()
  @Get(':id/content')
  @ApiOperation({ summary: 'Mengalirkan biner gambar dari Google Drive (dilindungi signed token HMAC)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'token', type: 'string', description: 'Token tanda tangan HMAC yang valid' })
  @ApiProduces('image/jpeg', 'image/png')
  @ApiResponse({ status: 200, description: 'Aliran biner file gambar' })
  @ApiResponse({ status: 401, description: 'Token tidak valid atau kedaluwarsa' })
  @ApiResponse({ status: 404, description: 'Lampiran tidak ditemukan di database atau Drive' })
  @ApiResponse({ status: 409, description: 'DRIVE_RECONNECT_REQUIRED' })
  @ApiResponse({ status: 502, description: 'Layanan Drive tidak dapat diakses (DRIVE_UNAVAILABLE)' })
  async getAttachmentContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mimeType } =
      await this.attachmentsService.getAttachmentContent(id, token);

    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });

    return new StreamableFile(stream);
  }

  /**
   * Menghapus lampiran, merapatkan posisi lampiran yang tersisa, dan memindahkan file ke Trash Drive.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Menghapus lampiran foto dari logbook' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Lampiran berhasil dihapus' })
  @ApiResponse({ status: 401, description: 'Access token tidak valid' })
  @ApiResponse({ status: 404, description: 'Lampiran tidak ditemukan' })
  async deleteAttachment(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.attachmentsService.deleteAttachment(user.userId, id);
  }
}

