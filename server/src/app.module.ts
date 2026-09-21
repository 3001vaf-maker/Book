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
import { FinanceModule } from './finance/finance.module';
import { NotificationModule } from './notification/notification.module';
import { CommunicationModule } from './communication/communication.module';
import { SaasAccessModule } from './saas-access/saas-access.module';
import { TenantInvitationModule } from './tenant-invitation/tenant-invitation.module';
import { SaasAdminModule } from './saas-admin/saas-admin.module';
import { FirstRunModule } from './first-run/first-run.module';

@Module({
  imports: [
    AuthModule,
    WorkspaceModule,
    ProfileModule,
    BusinessStateModule,
    TenantDocumentArchiveModule,
    AuxiliaryStateModule,
    FinanceModule,
    NotificationModule,
    CommunicationModule,
    OnlineBookingModule,
    SaasAccessModule,
    TenantInvitationModule,
    SaasAdminModule,
    FirstRunModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
