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
import type { Invoice, InvoiceSummary, User } from '@studioflow/contracts'
import { CurrentUser } from '../auth/current-user.decorator'
import {
  GenerateInvoiceDto,
  InvoiceDto,
  InvoiceSummaryDto,
  UpdateInvoiceDto,
} from './invoices.dto'
import { InvoicesService } from './invoices.service'

@ApiTags('invoices')
@ApiUnauthorizedResponse({ description: 'No active session.' })
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOkResponse({ type: InvoiceSummaryDto, isArray: true })
  findAll(@CurrentUser() user: User): Promise<InvoiceSummary[]> {
    return this.invoices.findAllForOwner(user.id)
  }

  @Get(':id')
  @ApiOkResponse({ type: InvoiceDto })
  @ApiNotFoundResponse({ description: 'No such invoice on this account.' })
  findOne(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<Invoice> {
    return this.invoices.findOneForOwner(user.id, id)
  }

  /**
   * Not POST /invoices: the caller is not submitting an invoice, it is asking
   * the server to work out what is owed and write one.
   */
  @Post('generate')
  @ApiCreatedResponse({ type: InvoiceDto })
  @ApiConflictResponse({ description: 'No unbilled time in that period.' })
  @ApiNotFoundResponse({ description: 'No such client on this account.' })
  generate(
    @CurrentUser() user: User,
    @Body() body: GenerateInvoiceDto,
  ): Promise<Invoice> {
    return this.invoices.generateForOwner(user.id, body)
  }

  @Patch(':id')
  @ApiOkResponse({ type: InvoiceDto })
  @ApiNotFoundResponse({ description: 'No such invoice on this account.' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: UpdateInvoiceDto,
  ): Promise<Invoice> {
    return this.invoices.updateForOwner(user.id, id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Invoice deleted; its hours become billable again.',
  })
  @ApiNotFoundResponse({ description: 'No such invoice on this account.' })
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.invoices.removeForOwner(user.id, id)
  }
}
