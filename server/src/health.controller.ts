import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

function isHttpsUrl(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return false;
  try { return new URL(text).protocol === 'https:'; } catch { return false; }
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.prisma.$queryRaw`SELECT 1 FROM "Profile" LIMIT 1`;
      await this.prisma.$queryRaw`SELECT 1 FROM "Workplace" LIMIT 1`;
      await this.prisma.$queryRaw`SELECT 1 FROM "BusinessStateMeta" LIMIT 1`;
      await this.prisma.$queryRaw`SELECT 1 FROM "BusinessOperationalState" LIMIT 1`;
      await this.prisma.$queryRaw`SELECT 1 FROM "BusinessDocumentState" LIMIT 1`;
      const telegramReady = Boolean(String(process.env.TELEGRAM_CREDENTIALS_KEY || '').trim())
        && isHttpsUrl(process.env.PUBLIC_API_URL)
        && isHttpsUrl(process.env.CLIENT_APP_URL);
      return {
        status: 'ok',
        database: 'ok',
        profileStorage: 'ok',
        businessStorage: 'ok',
        operationalStorage: 'ok',
        documentStorage: 'ok',
        bookingAutonomy: 'server',
        telegramRuntime: telegramReady ? 'ready' : 'unconfigured',
        release: 'clean-launch-reset-v2-redeploy',
        cleanResetMigration: '20260916150000_clean_launch_reset',
      };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unavailable' });
    }
  }
}
