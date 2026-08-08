import { Controller, Get } from '@nestjs/common'
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Client, User } from '@studioflow/contracts'
import { CurrentUser } from '../auth/current-user.decorator'
import { ClientDto } from './clients.dto'
import { ClientsService } from './clients.service'

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  // No @Public(), so the globally registered SessionAuthGuard protects this.
  @Get()
  @ApiOkResponse({ type: ClientDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'No active session.' })
  findAll(@CurrentUser() user: User): Promise<Client[]> {
    return this.clients.findAllForOwner(user.id)
  }
}
