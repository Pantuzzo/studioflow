import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { TimeEntry, User } from '@studioflow/contracts'
import { CurrentUser } from '../auth/current-user.decorator'
import {
  CreateTimeEntryDto,
  StartTimerDto,
  TimeEntryDto,
  UpdateTimeEntryDto,
} from './time-entries.dto'
import { TimeEntriesService } from './time-entries.service'

@ApiTags('time-entries')
@ApiUnauthorizedResponse({ description: 'No active session.' })
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly entries: TimeEntriesService) {}

  @Get()
  @ApiOkResponse({ type: TimeEntryDto, isArray: true })
  findAll(@CurrentUser() user: User): Promise<TimeEntry[]> {
    return this.entries.findAllForOwner(user.id)
  }

  /** Declared before any ":id" route would be, so "running" is never an id. */
  @Get('running')
  @ApiOkResponse({ type: TimeEntryDto, nullable: true })
  findRunning(@CurrentUser() user: User): Promise<TimeEntry | null> {
    return this.entries.findRunningForOwner(user.id)
  }

  /**
   * Distinct from POST /time-entries on purpose: starting a timer is not the
   * client submitting a record, it is asking the server to note the time.
   */
  @Post('start')
  @ApiCreatedResponse({ type: TimeEntryDto })
  @ApiConflictResponse({ description: 'A timer is already running.' })
  @ApiNotFoundResponse({ description: 'No such project on this account.' })
  start(
    @CurrentUser() user: User,
    @Body() body: StartTimerDto,
  ): Promise<TimeEntry> {
    return this.entries.startForOwner(user.id, body)
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimeEntryDto })
  @ApiConflictResponse({ description: 'That entry has already been stopped.' })
  stop(@CurrentUser() user: User, @Param('id') id: string): Promise<TimeEntry> {
    return this.entries.stopForOwner(user.id, id)
  }

  @Post()
  @ApiCreatedResponse({ type: TimeEntryDto })
  @ApiNotFoundResponse({ description: 'No such project on this account.' })
  create(
    @CurrentUser() user: User,
    @Body() body: CreateTimeEntryDto,
  ): Promise<TimeEntry> {
    return this.entries.createForOwner(user.id, body)
  }

  @Patch(':id')
  @ApiOkResponse({ type: TimeEntryDto })
  @ApiNotFoundResponse({ description: 'No such entry or project here.' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: UpdateTimeEntryDto,
  ): Promise<TimeEntry> {
    return this.entries.updateForOwner(user.id, id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Entry deleted.' })
  @ApiNotFoundResponse({ description: 'No such entry on this account.' })
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.entries.removeForOwner(user.id, id)
  }
}
