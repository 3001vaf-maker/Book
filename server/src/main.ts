import { NestFactory } from '@nestjs/core';
import { json, static as serveStatic, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

const API_HOST = 'api.va-tools.ru';
const BOOK_HOST = 'book.va-tools.ru';
const CLIENT_HOST = 'client.va-tools.ru';

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function requestHost(request: Request) {
  const forwarded = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const raw = forwarded || String(request.headers.host || '').trim();
  return raw.split(':')[0].trim().toLowerCase();
}

function allowedOrigins() {
  if (process.env.NODE_ENV === 'production') {
    return [
      `https://${BOOK_HOST}`,
      `https://${CLIENT_HOST}`,
      `https://${API_HOST}`,
    ];
  }

  const frontendOrigin = normalizeOrigin(
    String(process.env.FRONTEND_ORIGIN || 'http://localhost:8080').trim(),
  );
  const origins: Array<string | RegExp> = [frontendOrigin];
  if (frontendOrigin === 'http://localhost:8080') {
    origins.push(/^https:\/\/[a-z0-9-]+-8080\.app\.github\.dev$/i);
  }
  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  const siteRoot = resolve(process.cwd(), '../site');
  const staticSite = serveStatic(siteRoot, {
    index: 'index.html',
    fallthrough: true,
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    if (!['GET', 'HEAD'].includes(request.method)) return next();

    const host = requestHost(request);
    if (host === API_HOST) return next();

    if (host === BOOK_HOST || host === CLIENT_HOST) {
      return staticSite(request, response, () => response.status(404).send('Not Found'));
    }

    return next();
  });

  app.enableCors({
    origin: allowedOrigins(),
    credentials: true,
  });

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
