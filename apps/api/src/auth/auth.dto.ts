import {
  forgotPasswordSchema,
  loginSchema,
  sessionSchema,
  signupSchema,
} from '@studioflow/contracts'
import { createZodDto } from 'nestjs-zod'

/**
 * The shared Zod schemas become Nest DTOs here, so runtime validation and the
 * published Swagger docs both derive from the one contract the web client uses.
 */
export class LoginDto extends createZodDto(loginSchema) {}
export class SignupDto extends createZodDto(signupSchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class SessionDto extends createZodDto(sessionSchema) {}
