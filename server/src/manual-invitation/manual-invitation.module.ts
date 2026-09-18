import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserInvitationModule } from '../user-invitation/user-invitation.module';
import { PrismaService } from '../prisma.service';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import {
  ManualInvitationAdminController,
  ManualInvitationController,
} from './manual-invitation.controller';
import { ManualInvitationService } from './manual-invitation.service';

@Module({
  imports: [AuthModule, UserInvitationModule],
  controllers: [ManualInvitationAdminController, ManualInvitationController],
  providers: [ManualInvitationService, PlatformAdminGuard, PrismaService],
})
export class ManualInvitationModule {}
