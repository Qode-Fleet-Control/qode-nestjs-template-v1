import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DEFAULT_API_VERSION } from './common/api-versions';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Kong terminates TLS and forwards over HTTP, so trust the proxy to make
  // req.protocol/req.ip reflect the external values from the X-Forwarded-* headers.
  app.set('trust proxy', 1);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // URI versioning: routes resolve version -> route, so the items resource
  // serves under /v1/.... /health opts out with VERSION_NEUTRAL so it needs no
  // version segment and resolves at /health for the readiness probe.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: DEFAULT_API_VERSION,
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
