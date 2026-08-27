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
import type { Client, User } from '@studioflow/contracts'
import { CurrentUser } from '../auth/current-user.decorator'
import { ClientDto, CreateClientDto, UpdateClientDto } from './clients.dto'
import { ClientsService } from './clients.service'

@ApiTags('clients')
@ApiUnauthorizedResponse({ description: 'No active session.' })
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  // No @Public() anywhere in this controller, so the globally registered
  // SessionAuthGuard protects every route — and CsrfGuard the writing ones.
  @Get()
  @ApiOkResponse({ type: ClientDto, isArray: true })
  findAll(@CurrentUser() user: User): Promise<Client[]> {
    return this.clients.findAllForOwner(user.id)
  }

  @Post()
  @ApiCreatedResponse({ type: ClientDto })
  create(
    @CurrentUser() user: User,
    @Body() body: CreateClientDto,
  ): Promise<Client> {
    return this.clients.createForOwner(user.id, body)
  }

  @Patch(':id')
  @ApiOkResponse({ type: ClientDto })
  @ApiNotFoundResponse({ description: 'No such client on this account.' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: UpdateClientDto,
  ): Promise<Client> {
    return this.clients.updateForOwner(user.id, id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Client deleted.' })
  @ApiNotFoundResponse({ description: 'No such client on this account.' })
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.clients.removeForOwner(user.id, id)
  }
}
