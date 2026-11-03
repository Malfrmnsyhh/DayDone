import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { LogsController } from './logs.controller.js';
import { LogsService } from './logs.service.js';

@Module({
  imports: [AttachmentsModule],
  controllers: [LogsController],
  providers: [LogsService],
})
export class LogsModule {}
