import {
  generateInvoiceSchema,
  invoiceSchema,
  invoiceSummarySchema,
  updateInvoiceSchema,
} from '@studioflow/contracts'
import { createZodDto } from 'nestjs-zod'

/** Swagger reads the same schemas the web client validates against. */
export class InvoiceDto extends createZodDto(invoiceSchema) {}

export class InvoiceSummaryDto extends createZodDto(invoiceSummarySchema) {}

export class GenerateInvoiceDto extends createZodDto(generateInvoiceSchema) {}

export class UpdateInvoiceDto extends createZodDto(updateInvoiceSchema) {}
