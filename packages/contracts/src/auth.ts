import { z } from 'zod'

/**
 * The authenticated user as the API exposes it.
 * Note what is absent: no token of any kind. The browser's only credential is
 * an httpOnly session cookie it cannot read. See docs/adr/0006.
 */
export const userSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
})
export type User = z.infer<typeof userSchema>

/** Response body of login, signup and `GET /auth/me`. */
export const sessionSchema = z.object({ user: userSchema })
export type Session = z.infer<typeof sessionSchema>

/**
 * Passwords are capped as well as floored: an unbounded password is a cheap
 * way to make the server burn CPU hashing it.
 */
const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters')

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
export type LoginInput = z.infer<typeof loginSchema>

/** Wire contract for signup — `confirmPassword` is a UI concern, not an API one. */
export const signupSchema = z.object({
  name: z.string().min(1, 'Enter your name').max(80),
  email: z.email('Enter a valid email address'),
  password,
})
export type SignupInput = z.infer<typeof signupSchema>

/** What the signup form validates: the wire contract plus confirmation. */
export const signupFormSchema = signupSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirm your password') })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type SignupFormInput = z.infer<typeof signupFormSchema>

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

/** Uniform error body for every non-2xx response. */
export const apiErrorSchema = z.object({
  message: z.string(),
  statusCode: z.number().int().optional(),
})
export type ApiError = z.infer<typeof apiErrorSchema>
