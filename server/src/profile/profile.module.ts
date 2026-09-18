import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { SaasAccessModule } from '../saas-access/saas-access.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { WorkplaceLimitGuard } from './workplace-limit.guard';

@Module({
  imports: [AuthModule, SaasAccessModule],
  controllers: [ProfileController],
  providers: [ProfileService, WorkplaceLimitGuard, PrismaService],
  exports: [ProfileService],
})
export class ProfileModule {}
