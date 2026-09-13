import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessStateModule } from '../business-state/business-state.module';
import { CommunicationModule } from '../communication/communication.module';
import { DocumentStateModule } from '../document-state/document-state.module';
import { NotificationModule } from '../notification/notification.module';
import { ProfileModule } from '../profile/profile.module';
import { PrismaService } from '../prisma.service';
import { BookingAccountGuard } from './booking-account.guard';
import { BookingConsentController } from './booking-consent.controller';
import { BookingRequiredConsentGuard } from './booking-required-consent.guard';
import { ClientCardLinkService } from './client-card-link.service';
import { OnlineBookingController } from './online-booking.controller';
import { OnlineBookingService } from './online-booking.service';

@Module({
  imports: [AuthModule, BusinessStateModule, CommunicationModule, DocumentStateModule, NotificationModule, ProfileModule],
  controllers: [OnlineBookingController, BookingConsentController],
  providers: [OnlineBookingService, BookingAccountGuard, BookingRequiredConsentGuard, ClientCardLinkService, PrismaService],
})
export class OnlineBookingModule {}
