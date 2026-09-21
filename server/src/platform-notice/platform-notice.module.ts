import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { PlatformNoticeController } from './platform-notice.controller';
import { PlatformNoticeService } from './platform-notice.service';

@Module({
  imports: [AuthModule],
  controllers: [PlatformNoticeController],
  providers: [PlatformNoticeService, PrismaService],
  exports: [PlatformNoticeService],
})
export class PlatformNoticeModule {}
