import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MasterInvitationModule } from '../master-invitation/master-invitation.module';
import { PrismaService } from '../prisma.service';
import { PlatformDocumentsModule } from '../platform-documents/platform-documents.module';
import { SaasAccessModule } from '../saas-access/saas-access.module';
import { PlatformAdminGuard } from './platform-admin.guard';
import { SaasAdminController } from './saas-admin.controller';
import { SaasAdminService } from './saas-admin.service';

@Module({
  imports: [AuthModule, SaasAccessModule, MasterInvitationModule, PlatformDocumentsModule],
  controllers: [SaasAdminController],
  providers: [SaasAdminService, PlatformAdminGuard, PrismaService],
})
export class SaasAdminModule {}
