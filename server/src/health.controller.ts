import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

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
      return { status: 'ok', database: 'ok', profileStorage: 'ok', businessStorage: 'ok', operationalStorage: 'ok', documentStorage: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unavailable' });
    }
  }
}
