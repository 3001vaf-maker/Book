import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ProfileModule } from './profile/profile.module';
import { OnlineBookingModule } from './online-booking/online-booking.module';
import { BusinessStateModule } from './business-state/business-state.module';

@Module({
  imports: [AuthModule, WorkspaceModule, ProfileModule, BusinessStateModule, OnlineBookingModule],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
