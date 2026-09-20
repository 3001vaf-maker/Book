import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessStateModule } from '../business-state/business-state.module';
import { CommunicationModule } from '../communication/communication.module';
import { TenantDocumentArchiveModule } from '../tenant-document-archive/tenant-document-archive.module';
import { NotificationModule } from '../notification/notification.module';
import { ProfileModule } from '../profile/profile.module';
import { PrismaService } from '../prisma.service';
import { TimeModule } from '../time/time.module';
import { RecordModule } from '../record/record.module';
import { ProcedureModule } from '../procedure/procedure.module';
import { AccountGuard } from './account.guard';
import { AccountSettingsController } from './account-settings.controller';
import { BookingConsentController } from './booking-consent.controller';
import { BookingPdnConsentGuard } from './booking-pdn-consent.guard';
import { PersonIdentityService } from './person-identity.service';
import { OnlineBookingController } from './online-booking.controller';
import { OnlineBookingService } from './online-booking.service';

@Module({
  imports: [AuthModule, BusinessStateModule, CommunicationModule, TenantDocumentArchiveModule, NotificationModule, ProfileModule, TimeModule, RecordModule, ProcedureModule],
  controllers: [OnlineBookingController, BookingConsentController, AccountSettingsController],
  providers: [OnlineBookingService, AccountGuard, BookingPdnConsentGuard, PersonIdentityService, PrismaService],
})
export class OnlineBookingModule {}
