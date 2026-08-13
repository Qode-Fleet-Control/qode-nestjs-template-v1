import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DEFAULT_API_VERSION } from './common/api-versions';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Kong terminates TLS and forwards over HTTP, so trust the proxy to make
  // req.protocol/req.ip reflect the external values from the X-Forwarded-* headers.
  app.set('trust proxy', 1);

  // Mount under BASE_PATH when the app is served from a sub-path behind a
  // reverse proxy; unset/empty serves at the host root. /health opts out so
  // the readiness probe stays at /health regardless of the prefix.
  const raw = (process.env.BASE_PATH ?? '').trim();
  const basePath = raw ? '/' + raw.replace(/^\/+|\/+$/g, '') : '';
  if (basePath) {
    app.setGlobalPrefix(basePath, {
      exclude: [{ path: 'health', method: RequestMethod.GET }],
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // URI versioning: routes resolve version -> route, so the items resource
  // serves under /v1/.... /health opts out with VERSION_NEUTRAL and stays at
  // the root for the fleet's readiness probe.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: DEFAULT_API_VERSION,
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
