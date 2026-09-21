import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessStateModule } from '../business-state/business-state.module';
import { TenantDocumentArchiveModule } from '../tenant-document-archive/tenant-document-archive.module';
import { NotificationModule } from '../notification/notification.module';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';
import { PrismaService } from '../prisma.service';
import { CommunicationBroadcastService } from './communication-broadcast.service';
import { CommunicationController } from './communication.controller';
import { CommunicationDispatchService } from './communication-dispatch.service';
import { CommunicationHistoryService } from './communication-history.service';
import { CommunicationService } from './communication.service';
import { TelegramBotService } from './telegram-bot.service';
import { EmailChannelService } from './email-channel.service';
import { FirstRunModule } from '../first-run/first-run.module';

@Module({
  imports: [AuthModule, BusinessStateModule, TenantDocumentArchiveModule, NotificationModule, TransactionalEmailModule, FirstRunModule],
  controllers: [CommunicationController],
  providers: [CommunicationService, CommunicationHistoryService, CommunicationDispatchService, CommunicationBroadcastService, TelegramBotService, EmailChannelService, PrismaService],
  exports: [CommunicationService, CommunicationHistoryService, CommunicationDispatchService, CommunicationBroadcastService, TelegramBotService, EmailChannelService],
})
export class CommunicationModule {}
