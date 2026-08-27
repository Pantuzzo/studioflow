import {
  clientSchema,
  createClientSchema,
  updateClientSchema,
} from '@studioflow/contracts'
import { createZodDto } from 'nestjs-zod'

/** Swagger reads the same schema the web client validates against. */
export class ClientDto extends createZodDto(clientSchema) {}

export class CreateClientDto extends createZodDto(createClientSchema) {}

export class UpdateClientDto extends createZodDto(updateClientSchema) {}
