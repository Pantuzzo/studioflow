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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Project, User } from '@studioflow/contracts'
import { CurrentUser } from '../auth/current-user.decorator'
import { CreateProjectDto, ProjectDto, UpdateProjectDto } from './projects.dto'
import { ProjectsService } from './projects.service'

@ApiTags('projects')
@ApiUnauthorizedResponse({ description: 'No active session.' })
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOkResponse({ type: ProjectDto, isArray: true })
  findAll(@CurrentUser() user: User): Promise<Project[]> {
    return this.projects.findAllForOwner(user.id)
  }

  @Post()
  @ApiCreatedResponse({ type: ProjectDto })
  @ApiNotFoundResponse({ description: 'No such client on this account.' })
  create(
    @CurrentUser() user: User,
    @Body() body: CreateProjectDto,
  ): Promise<Project> {
    return this.projects.createForOwner(user.id, body)
  }

  @Patch(':id')
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse({ description: 'No such project or client here.' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: UpdateProjectDto,
  ): Promise<Project> {
    return this.projects.updateForOwner(user.id, id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Project deleted.' })
  @ApiNotFoundResponse({ description: 'No such project on this account.' })
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.projects.removeForOwner(user.id, id)
  }
}
