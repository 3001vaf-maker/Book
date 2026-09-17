import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import { SaasAccessModule } from '../saas-access/saas-access.module';
import { LegalRuntimeService } from './legal-runtime.service';
import { MarketingConsentService } from './marketing-consent.service';
import { PlatformLegalAcceptanceController } from './platform-legal-acceptance.controller';
import { PlatformLegalController } from './platform-legal.controller';
import { TenantLegalController } from './tenant-legal.controller';

@Module({
  imports: [AuthModule, SaasAccessModule],
  controllers: [PlatformLegalController, PlatformLegalAcceptanceController, TenantLegalController],
  providers: [LegalRuntimeService, MarketingConsentService, PlatformAdminGuard, PrismaService],
  exports: [LegalRuntimeService, MarketingConsentService],
})
export class LegalRuntimeModule {}
