import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { LogsService } from './logs.service.js';
import {
  listLogsQuerySchema,
  type ListLogsQuery,
} from './dto/log.schema.js';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  findAll(@Query({ schema: listLogsQuerySchema }) query: ListLogsQuery) {
    return this.logsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.logsService.findOne(id);
  }
}
