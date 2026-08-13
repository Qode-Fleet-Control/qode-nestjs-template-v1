import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // The fleet mounts the app under BASE_PATH behind its ingress. Prefix every
  // route with it EXCEPT /health, which the fleet probes at the domain root.
  const basePath = process.env.BASE_PATH;
  if (basePath) {
    app.setGlobalPrefix(basePath, {
      exclude: [{ path: 'health', method: RequestMethod.GET }],
    });
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
