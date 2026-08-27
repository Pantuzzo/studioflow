import {
  createProjectSchema,
  projectSchema,
  updateProjectSchema,
} from '@studioflow/contracts'
import { createZodDto } from 'nestjs-zod'

/** Swagger reads the same schemas the web client validates against. */
export class ProjectDto extends createZodDto(projectSchema) {}

export class CreateProjectDto extends createZodDto(createProjectSchema) {}

export class UpdateProjectDto extends createZodDto(updateProjectSchema) {}
