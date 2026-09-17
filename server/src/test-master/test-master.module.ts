import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LegalRuntimeModule } from '../legal-runtime/legal-runtime.module';
import { MasterInvitationModule } from '../master-invitation/master-invitation.module';
import { PrismaService } from '../prisma.service';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import { TestMasterAdminController, TestMasterInvitationController } from './test-master.controller';
import { TestMasterService } from './test-master.service';

@Module({
  imports: [AuthModule, LegalRuntimeModule, MasterInvitationModule],
  controllers: [TestMasterAdminController, TestMasterInvitationController],
  providers: [TestMasterService, PlatformAdminGuard, PrismaService],
})
export class TestMasterModule {}
