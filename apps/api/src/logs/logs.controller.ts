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
import {
  CurrentUser,
  type CurrentUserData,
} from '../common/decorators/current-user.decorator.js';
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

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query({ schema: listLogsQuerySchema }) query: ListLogsQuery,
  ): Promise<PaginatedLogsResponse> {
    return this.logsService.findAll(user.userId, query);
  }

  @Get('by-date/:date')
  findByDate(
    @CurrentUser() user: CurrentUserData,
    @Param({ schema: dateParamSchema }) params: DateParam,
  ): Promise<LogResponse> {
    return this.logsService.findByDate(user.userId, params.date);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LogResponse> {
    return this.logsService.findOne(user.userId, id);
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserData,
    @Body({ schema: createLogSchema }) dto: CreateLogDto,
  ): Promise<LogResponse> {
    return this.logsService.create(user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateLogSchema }) dto: UpdateLogDto,
  ): Promise<LogResponse> {
    return this.logsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.logsService.remove(user.userId, id);
  }
}
