import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { BookingAccountGuard } from './booking-account.guard';
import { OnlineBookingController } from './online-booking.controller';
import { OnlineBookingService } from './online-booking.service';

@Module({
  imports: [AuthModule],
  controllers: [OnlineBookingController],
  providers: [OnlineBookingService, BookingAccountGuard, PrismaService],
})
export class OnlineBookingModule {}
