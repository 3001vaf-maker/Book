import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  const frontendOrigin = normalizeOrigin(
    String(process.env.FRONTEND_ORIGIN || 'http://localhost:8080').trim(),
  );
  const allowedOrigins: Array<string | RegExp> = [frontendOrigin];
  if (frontendOrigin === 'http://localhost:8080') {
    allowedOrigins.push(/^https:\/\/[a-z0-9-]+-8080\.app\.github\.dev$/i);
  }
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
