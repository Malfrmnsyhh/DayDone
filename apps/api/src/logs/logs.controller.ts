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
} from '@nestjs/common';
import { LogsService } from './logs.service.js';
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

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  findAll(@Query({ schema: listLogsQuerySchema }) query: ListLogsQuery) {
    return this.logsService.findAll(query);
  }

  @Get('by-date/:date')
  findByDate(@Param({ schema: dateParamSchema }) params: DateParam) {
    return this.logsService.findByDate(params.date);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.logsService.findOne(id);
  }

  @Post()
  create(@Body({ schema: createLogSchema }) dto: CreateLogDto) {
    return this.logsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateLogSchema }) dto: UpdateLogDto,
  ) {
    return this.logsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    this.logsService.remove(id);
  }
}
