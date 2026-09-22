import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { PlatformNoticeModule } from '../platform-notice/platform-notice.module';
import { FirstRunController } from './first-run.controller';
import { FirstRunService } from './first-run.service';

@Module({
  imports: [AuthModule, PlatformNoticeModule],
  controllers: [FirstRunController],
  providers: [FirstRunService, PrismaService],
  exports: [FirstRunService],
})
export class FirstRunModule {}
