import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendOrigin = String(process.env.FRONTEND_ORIGIN || 'http://localhost:8080').trim();
  app.enableCors({
    origin: frontendOrigin,
    credentials: true,
  });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
