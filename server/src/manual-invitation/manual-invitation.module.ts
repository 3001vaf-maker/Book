import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import { TenantInvitationModule } from '../tenant-invitation/tenant-invitation.module';
import { ManualInvitationAdminController, ManualInvitationController } from './manual-invitation.controller';
import { ManualInvitationService } from './manual-invitation.service';

@Module({
  imports: [AuthModule, TenantInvitationModule],
  controllers: [ManualInvitationAdminController, ManualInvitationController],
  providers: [ManualInvitationService, PlatformAdminGuard, PrismaService],
})
export class ManualInvitationModule {}
