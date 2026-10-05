import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantDocumentArchiveModule } from '../tenant-document-archive/tenant-document-archive.module';
import { PrismaService } from '../prisma.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { WebPushService } from './web-push.service';

@Module({
  imports: [AuthModule, TenantDocumentArchiveModule],
  controllers: [NotificationController],
  providers: [NotificationService, WebPushService, PrismaService],
  exports: [NotificationService, WebPushService],
})
export class NotificationModule {}
