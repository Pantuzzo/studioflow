import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'
import type { Env } from './config/env'

async function bootstrap(): Promise<void> {
  // rawBody keeps the unparsed request buffer available on `req.rawBody`.
  // Stripe signs the exact bytes it sent, so verifying a signature against a
  // re-serialised JSON object fails for reasons nobody enjoys debugging.
  const app = await NestFactory.create(AppModule, { rawBody: true })
  const config = app.get(ConfigService<Env, true>)

  app.setGlobalPrefix('api')
  app.use(helmet())
  app.use(cookieParser())

  // The browser authenticates with a cookie, so the allowed origin is explicit
  // and credentials are opt-in. A wildcard origin cannot carry credentials.
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
  })

  app.enableShutdownHooks()

  // Swagger reads the same Zod schemas the runtime validates against, so the
  // published docs cannot drift from the contract.
  const documentConfig = new DocumentBuilder()
    .setTitle('StudioFlow API')
    .setDescription(
      'Operations API for agencies and freelancers. Authentication is a session cookie; no token is ever exposed to the browser.',
    )
    .setVersion('0.1.0')
    .addCookieAuth('sf_session')
    .build()
  const document = SwaggerModule.createDocument(app, documentConfig)
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document))

  const port = config.get('PORT', { infer: true })
  await app.listen(port)
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap')
  Logger.log(`Docs on http://localhost:${port}/docs`, 'Bootstrap')
}

void bootstrap()
