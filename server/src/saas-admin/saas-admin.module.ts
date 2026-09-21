import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantInvitationModule } from '../tenant-invitation/tenant-invitation.module';
import { DocumentRegistryModule } from '../document-registry/document-registry.module';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';
import { PrismaService } from '../prisma.service';
import { SaasAccessModule } from '../saas-access/saas-access.module';
import { PlatformAdminGuard } from './platform-admin.guard';
import { SaasAdminController } from './saas-admin.controller';
import { SaasAdminService } from './saas-admin.service';
import { FirstRunModule } from '../first-run/first-run.module';

@Module({
  imports: [AuthModule, SaasAccessModule, TenantInvitationModule, DocumentRegistryModule, TransactionalEmailModule, FirstRunModule],
  controllers: [SaasAdminController],
  providers: [SaasAdminService, PlatformAdminGuard, PrismaService],
})
export class SaasAdminModule {}
