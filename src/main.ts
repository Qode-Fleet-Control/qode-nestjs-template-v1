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

  // Mount under BASE_PATH when the app is served from a sub-path behind a
  // reverse proxy; unset/empty serves at the host root. The proxy forwards the
  // full path, so every route including /health resolves under the prefix.
  const raw = (process.env.BASE_PATH ?? '').trim();
  const basePath = raw ? '/' + raw.replace(/^\/+|\/+$/g, '') : '';
  if (basePath) {
    app.setGlobalPrefix(basePath);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // URI versioning: routes resolve version -> route, so the items resource
  // serves under /v1/.... /health opts out with VERSION_NEUTRAL so it needs no
  // version segment and resolves at <BASE_PATH>/health for the readiness probe.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: DEFAULT_API_VERSION,
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
