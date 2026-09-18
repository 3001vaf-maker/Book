import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessStateModule } from '../business-state/business-state.module';
import { CommunicationModule } from '../communication/communication.module';
import { DocumentStateModule } from '../document-state/document-state.module';
import { LegalRuntimeModule } from '../legal-runtime/legal-runtime.module';
import { NotificationModule } from '../notification/notification.module';
import { ProfileModule } from '../profile/profile.module';
import { PrismaService } from '../prisma.service';
import { BookingAccountGuard } from './booking-account.guard';
import { BookingAccountSettingsController } from './booking-account-settings.controller';
import { BookingChatController } from './booking-chat.controller';
import { BookingConsentController } from './booking-consent.controller';
import { BookingMarketingConsentController } from './booking-marketing-consent.controller';
import { BookingPublicationGuard } from './booking-publication.guard';
import { BookingRequiredConsentGuard } from './booking-required-consent.guard';
import { ClientCardLinkService } from './client-card-link.service';
import { OnlineBookingController } from './online-booking.controller';
import { OnlineBookingService } from './online-booking.service';
import { TelegramBookingAuthController } from './telegram-booking-auth.controller';
import { TelegramBookingAuthService } from './telegram-booking-auth.service';
import { TelegramWebAppAuthService } from './telegram-webapp-auth.service';

@Module({
  imports: [AuthModule, BusinessStateModule, CommunicationModule, DocumentStateModule, LegalRuntimeModule, NotificationModule, ProfileModule],
  controllers: [OnlineBookingController, BookingChatController, BookingConsentController, BookingMarketingConsentController, BookingAccountSettingsController, TelegramBookingAuthController],
  providers: [OnlineBookingService, TelegramBookingAuthService, TelegramWebAppAuthService, BookingAccountGuard, BookingPublicationGuard, BookingRequiredConsentGuard, ClientCardLinkService, PrismaService],
})
export class OnlineBookingModule {}
