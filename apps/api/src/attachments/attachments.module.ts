import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { ImageProcessorService } from './image-processor.service.js';
import { SignedUrlService } from './signed-url.service.js';

@Module({
  imports: [StorageModule],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    ImageProcessorService,
    SignedUrlService,
  ],
  exports: [AttachmentsService, SignedUrlService],
})
export class AttachmentsModule {}

