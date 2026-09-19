import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ProfileModule } from './profile/profile.module';
import { OnlineBookingModule } from './online-booking/online-booking.module';
import { BusinessStateModule } from './business-state/business-state.module';
import { TenantDocumentArchiveModule } from './tenant-document-archive/tenant-document-archive.module';
import { AuxiliaryStateModule } from './auxiliary-state/auxiliary-state.module';
import { NotificationModule } from './notification/notification.module';
import { CommunicationModule } from './communication/communication.module';
import { SaasAccessModule } from './saas-access/saas-access.module';
import { InvitationModule } from './invitation/invitation.module';
import { SaasAdminModule } from './saas-admin/saas-admin.module';

@Module({
  imports: [
    AuthModule,
    WorkspaceModule,
    ProfileModule,
    BusinessStateModule,
    TenantDocumentArchiveModule,
    AuxiliaryStateModule,
    NotificationModule,
    CommunicationModule,
    OnlineBookingModule,
    SaasAccessModule,
    InvitationModule,
    SaasAdminModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
