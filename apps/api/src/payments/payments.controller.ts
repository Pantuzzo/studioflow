import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common'
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import type { CheckoutSession, User } from '@studioflow/contracts'
import { Public, SkipCsrf } from '../auth/auth.constants'
import { CurrentUser } from '../auth/current-user.decorator'
import { CheckoutSessionDto } from './payments.dto'
import { PaymentsService } from './payments.service'

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('invoices/:id/checkout')
  @ApiCreatedResponse({ type: CheckoutSessionDto })
  @ApiUnauthorizedResponse({ description: 'No active session.' })
  @ApiNotFoundResponse({ description: 'No such invoice on this account.' })
  @ApiConflictResponse({ description: 'That invoice cannot be paid.' })
  checkout(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<CheckoutSession> {
    return this.payments.createCheckoutSession(user.id, id)
  }

  /**
   * Stripe's callback.
   *
   * Public because Stripe has no session, and exempt from CSRF because it
   * sends no cookie: it proves who it is with a signature over the raw body,
   * which this route verifies before doing anything at all.
   *
   * It always answers 200 once the signature checks out, including for events
   * it does not handle and for duplicates. A non-2xx tells Stripe to retry,
   * and retrying an event that was understood and ignored achieves nothing.
   */
  @Post('stripe/webhook')
  @Public()
  @SkipCsrf()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
    @Body() _body: unknown,
  ): Promise<{ received: boolean }> {
    const raw = request.rawBody
    if (!raw) {
      // Without the exact bytes there is nothing to verify against.
      throw new Error('Raw body unavailable; see rawBody in main.ts')
    }

    const event = this.payments.verifyEvent(raw, signature)
    await this.payments.handleEvent(event)
    return { received: true }
  }
}
