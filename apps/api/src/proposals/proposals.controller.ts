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
import type { Proposal, ProposalSummary, User } from '@studioflow/contracts'
import { CurrentUser } from '../auth/current-user.decorator'
import {
  CreateProposalDto,
  ProposalDto,
  ProposalSummaryDto,
  UpdateProposalDto,
} from './proposals.dto'
import { ProposalsService } from './proposals.service'

@ApiTags('proposals')
@ApiUnauthorizedResponse({ description: 'No active session.' })
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  /** Summaries only: the index has no use for every document body. */
  @Get()
  @ApiOkResponse({ type: ProposalSummaryDto, isArray: true })
  findAll(@CurrentUser() user: User): Promise<ProposalSummary[]> {
    return this.proposals.findAllForOwner(user.id)
  }

  @Get(':id')
  @ApiOkResponse({ type: ProposalDto })
  @ApiNotFoundResponse({ description: 'No such proposal on this account.' })
  findOne(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<Proposal> {
    return this.proposals.findOneForOwner(user.id, id)
  }

  @Post()
  @ApiCreatedResponse({ type: ProposalDto })
  @ApiNotFoundResponse({ description: 'No such client or project here.' })
  create(
    @CurrentUser() user: User,
    @Body() body: CreateProposalDto,
  ): Promise<Proposal> {
    return this.proposals.createForOwner(user.id, body)
  }

  /** Where autosave lands. */
  @Patch(':id')
  @ApiOkResponse({ type: ProposalDto })
  @ApiNotFoundResponse({ description: 'No such proposal, client or project.' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: UpdateProposalDto,
  ): Promise<Proposal> {
    return this.proposals.updateForOwner(user.id, id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Proposal deleted.' })
  @ApiNotFoundResponse({ description: 'No such proposal on this account.' })
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.proposals.removeForOwner(user.id, id)
  }
}
