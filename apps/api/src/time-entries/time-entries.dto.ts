import {
  createTimeEntrySchema,
  startTimerSchema,
  timeEntrySchema,
  updateTimeEntrySchema,
} from '@studioflow/contracts'
import { createZodDto } from 'nestjs-zod'

/** Swagger reads the same schemas the web client validates against. */
export class TimeEntryDto extends createZodDto(timeEntrySchema) {}

export class StartTimerDto extends createZodDto(startTimerSchema) {}

export class CreateTimeEntryDto extends createZodDto(createTimeEntrySchema) {}

export class UpdateTimeEntryDto extends createZodDto(updateTimeEntrySchema) {}
