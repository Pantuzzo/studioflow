import { checkoutSessionSchema } from '@studioflow/contracts'
import { createZodDto } from 'nestjs-zod'

export class CheckoutSessionDto extends createZodDto(checkoutSessionSchema) {}
