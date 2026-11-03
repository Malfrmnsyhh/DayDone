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
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import {
  CurrentUser,
  type CurrentUserData,
} from '../common/decorators/current-user.decorator.js';
import { AttachmentsService } from './attachments.service.js';
import type { AttachmentUrlResponse } from './dto/attachment.types.js';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * Menghasilkan signed URL sementara (5 menit) untuk lampiran tertentu.
   */
  @Get(':id/url')
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
  async deleteAttachment(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.attachmentsService.deleteAttachment(user.userId, id);
  }
}

