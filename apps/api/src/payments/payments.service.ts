import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  invoiceLinesSchema,
  invoiceLineTotalCents,
  type CheckoutSession,
} from '@studioflow/contracts'
import type Stripe from 'stripe'
import type { Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'
import { STRIPE_CLIENT, type MaybeStripe } from './stripe.provider'

/** Statuses from which asking for payment makes sense. */
const PAYABLE = new Set(['draft', 'sent'])

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(STRIPE_CLIENT) private readonly stripe: MaybeStripe,
  ) {}

  private requireStripe(): Stripe {
    if (!this.stripe) {
      // A missing key is a configuration fact, not a client error, but the
      // caller still needs a clear answer rather than a 500.
      throw new BadRequestException('Payments are not configured')
    }
    return this.stripe
  }

  /**
   * A hosted Checkout page for one invoice.
   *
   * The amounts come from the stored invoice, never from the request: the
   * browser says which invoice, and the server says what it costs.
   */
  async createCheckoutSession(
    ownerId: string,
    invoiceId: string,
  ): Promise<CheckoutSession> {
    const stripe = this.requireStripe()

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, ownerId },
    })
    if (!invoice) throw new NotFoundException('Invoice not found')
    if (invoice.status === 'paid') {
      throw new ConflictException('That invoice is already paid')
    }
    if (!PAYABLE.has(invoice.status)) {
      throw new ConflictException(
        `Cannot take payment for a ${invoice.status} invoice`,
      )
    }

    const lines = invoiceLinesSchema.parse(invoice.lines)
    if (lines.length === 0) {
      throw new ConflictException('That invoice has nothing to pay')
    }

    const webOrigin = this.config.get('WEB_ORIGIN', { infer: true })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Stripe's quantity is an integer and hours are not, so each line is sent
      // as a single item priced at its own total. Sending 12.5 as a quantity
      // would either be rejected or silently rounded, and the customer would be
      // charged an amount the invoice does not say.
      line_items: lines.map((line) => ({
        quantity: 1,
        price_data: {
          currency: invoice.currency.toLowerCase(),
          unit_amount: invoiceLineTotalCents(line),
          product_data: {
            name: line.description,
            description: `${line.quantityHours} hours`,
          },
        },
      })),
      // The only link back that survives a webhook arriving out of nowhere.
      metadata: { invoiceId: invoice.id },
      success_url: `${webOrigin}/invoices/${invoice.id}?paid=1`,
      cancel_url: `${webOrigin}/invoices/${invoice.id}`,
    })

    if (!session.url) {
      throw new ConflictException('Stripe did not return a checkout URL')
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { stripeSessionId: session.id },
    })

    return { url: session.url }
  }

  /**
   * Verify that an event really came from Stripe.
   *
   * The signature covers the exact bytes Stripe sent, which is why the raw
   * body is kept: verifying against a re-serialised object fails. An
   * unverifiable event is not a suspicious event to log and continue past, it
   * is somebody posting to a public endpoint.
   */
  verifyEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    const stripe = this.requireStripe()
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true })
    if (!secret) throw new BadRequestException('Payments are not configured')
    if (!signature) throw new BadRequestException('Missing signature')

    try {
      return stripe.webhooks.constructEvent(rawBody, signature, secret)
    } catch {
      throw new BadRequestException('Invalid signature')
    }
  }

  /**
   * Act on a verified event, at most once.
   *
   * Stripe redelivers on its own retry schedule, after a timeout, and whenever
   * someone replays an event from the dashboard. Recording the event id first
   * turns "handlers must be idempotent" into "handlers run once", and the
   * unique primary key is what makes that true under concurrent delivery.
   */
  async handleEvent(event: Stripe.Event): Promise<{ handled: boolean }> {
    try {
      await this.prisma.webhookEvent.create({
        data: { id: event.id, type: event.type },
      })
    } catch {
      // Already seen. Answering 200 is deliberate: an error would make Stripe
      // retry an event that has been fully processed.
      this.logger.log(`Ignoring duplicate delivery of ${event.id}`)
      return { handled: false }
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        // The subtlety this whole module exists for: a completed session is
        // not a received payment. For a card the two coincide; for a bank
        // debit the money lands days later, and marking it paid here would be
        // a lie the accounting believes.
        await this.settle(
          session,
          session.payment_status === 'paid' ? 'paid' : 'processing',
        )
        break
      }

      case 'checkout.session.async_payment_succeeded':
        await this.settle(event.data.object, 'paid')
        break

      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        // Back to where it was: still owed, no longer in flight.
        await this.settle(event.data.object, 'sent')
        break

      default:
        this.logger.log(`No handler for ${event.type}`)
    }

    return { handled: true }
  }

  private async settle(
    session: Stripe.Checkout.Session,
    status: 'paid' | 'processing' | 'sent',
  ): Promise<void> {
    const invoiceId = session.metadata?.['invoiceId']
    const invoice = invoiceId
      ? await this.prisma.invoice.findUnique({ where: { id: invoiceId } })
      : await this.prisma.invoice.findUnique({
          where: { stripeSessionId: session.id },
        })

    if (!invoice) {
      // Not an error worth retrying: the invoice is gone, and Stripe should
      // stop resending.
      this.logger.warn(`No invoice for session ${session.id}`)
      return
    }

    // Paid is terminal. Events arrive out of order, and a late "expired" for a
    // session that was already settled must not un-pay a paid invoice.
    if (invoice.status === 'paid' && status !== 'paid') return
    // A voided invoice is not waiting for money.
    if (invoice.status === 'void') return

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status,
        paidAt: status === 'paid' ? (invoice.paidAt ?? new Date()) : null,
      },
    })
  }
}
