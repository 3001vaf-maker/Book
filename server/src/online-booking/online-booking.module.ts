import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessStateModule } from '../business-state/business-state.module';
import { DocumentStateModule } from '../document-state/document-state.module';
import { ProfileModule } from '../profile/profile.module';
import { PrismaService } from '../prisma.service';
import { BookingAccountGuard } from './booking-account.guard';
import { OnlineBookingController } from './online-booking.controller';
import { OnlineBookingService } from './online-booking.service';

@Module({
  imports: [AuthModule, BusinessStateModule, DocumentStateModule, ProfileModule],
  controllers: [OnlineBookingController],
  providers: [OnlineBookingService, BookingAccountGuard, PrismaService],
})
export class OnlineBookingModule {}
