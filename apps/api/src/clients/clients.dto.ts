import { clientSchema } from '@studioflow/contracts'
import { createZodDto } from 'nestjs-zod'

/** Swagger reads the same schema the web client validates against. */
export class ClientDto extends createZodDto(clientSchema) {}
