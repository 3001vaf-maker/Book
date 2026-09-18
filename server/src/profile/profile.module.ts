import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { SaasAccessModule } from '../saas-access/saas-access.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileCreationPolicyService } from './profile-creation-policy.service';
import { TenantTimeZoneService } from './tenant-time-zone.service';
import { WorkplaceLimitGuard } from './workplace-limit.guard';

@Module({
  imports: [AuthModule, SaasAccessModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileCreationPolicyService, TenantTimeZoneService, WorkplaceLimitGuard, PrismaService],
  exports: [ProfileService, ProfileCreationPolicyService, TenantTimeZoneService],
})
export class ProfileModule {}
