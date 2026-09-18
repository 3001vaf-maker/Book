import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MasterInvitationModule } from '../master-invitation/master-invitation.module';
import { DocumentRegistryModule } from '../document-registry/document-registry.module';
import { PrismaService } from '../prisma.service';
import { SaasAccessModule } from '../saas-access/saas-access.module';
import { PlatformAdminGuard } from './platform-admin.guard';
import { SaasAdminController } from './saas-admin.controller';
import { SaasAdminService } from './saas-admin.service';

@Module({
  imports: [AuthModule, SaasAccessModule, MasterInvitationModule, DocumentRegistryModule],
  controllers: [SaasAdminController],
  providers: [SaasAdminService, PlatformAdminGuard, PrismaService],
})
export class SaasAdminModule {}
