import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { SaasAccessModule } from '../saas-access/saas-access.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { TenantTimeZoneService } from './tenant-time-zone.service';
import { WorkplaceLimitGuard } from './workplace-limit.guard';

@Module({
  imports: [AuthModule, SaasAccessModule],
  controllers: [ProfileController],
  providers: [ProfileService, TenantTimeZoneService, WorkplaceLimitGuard, PrismaService],
  exports: [ProfileService, TenantTimeZoneService],
})
export class ProfileModule {}
