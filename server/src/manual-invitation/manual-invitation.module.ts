import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MasterInvitationModule } from '../master-invitation/master-invitation.module';
import { PrismaService } from '../prisma.service';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import {
  ManualInvitationAdminController,
  ManualInvitationController,
} from './manual-invitation.controller';
import { ManualInvitationService } from './manual-invitation.service';

@Module({
  imports: [AuthModule, MasterInvitationModule],
  controllers: [ManualInvitationAdminController, ManualInvitationController],
  providers: [ManualInvitationService, PlatformAdminGuard, PrismaService],
})
export class ManualInvitationModule {}
