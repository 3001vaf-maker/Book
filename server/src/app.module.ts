import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ProfileModule } from './profile/profile.module';
import { OnlineBookingModule } from './online-booking/online-booking.module';
import { BusinessStateModule } from './business-state/business-state.module';
import { DocumentStateModule } from './document-state/document-state.module';
import { AuxiliaryStateModule } from './auxiliary-state/auxiliary-state.module';
import { NotificationModule } from './notification/notification.module';
import { CommunicationModule } from './communication/communication.module';
import { SaasAccessModule } from './saas-access/saas-access.module';
import { MasterInvitationModule } from './master-invitation/master-invitation.module';
import { SaasAdminModule } from './saas-admin/saas-admin.module';
import { ManualInvitationModule } from './manual-invitation/manual-invitation.module';

@Module({
  imports: [
    AuthModule,
    WorkspaceModule,
    ProfileModule,
    BusinessStateModule,
    DocumentStateModule,
    AuxiliaryStateModule,
    NotificationModule,
    CommunicationModule,
    OnlineBookingModule,
    SaasAccessModule,
    MasterInvitationModule,
    ManualInvitationModule,
    SaasAdminModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
