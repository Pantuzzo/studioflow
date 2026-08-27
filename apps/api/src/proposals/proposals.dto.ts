import {
  createProposalSchema,
  proposalSchema,
  proposalSummarySchema,
  updateProposalSchema,
} from '@studioflow/contracts'
import { createZodDto } from 'nestjs-zod'

/** Swagger reads the same schemas the editor validates against. */
export class ProposalDto extends createZodDto(proposalSchema) {}

export class ProposalSummaryDto extends createZodDto(proposalSummarySchema) {}

export class CreateProposalDto extends createZodDto(createProposalSchema) {}

export class UpdateProposalDto extends createZodDto(updateProposalSchema) {}
