import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessStateModule } from '../business-state/business-state.module';
import { DocumentArchiveModule } from '../document-archive/document-archive.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma.service';
import { CommunicationBroadcastService } from './communication-broadcast.service';
import { CommunicationController } from './communication.controller';
import { CommunicationDispatchService } from './communication-dispatch.service';
import { CommunicationHistoryService } from './communication-history.service';
import { CommunicationService } from './communication.service';
import { TelegramBotService } from './telegram-bot.service';

@Module({
  imports: [AuthModule, BusinessStateModule, DocumentArchiveModule, NotificationModule],
  controllers: [CommunicationController],
  providers: [CommunicationService, CommunicationHistoryService, CommunicationDispatchService, CommunicationBroadcastService, TelegramBotService, PrismaService],
  exports: [CommunicationService, CommunicationHistoryService, CommunicationDispatchService, CommunicationBroadcastService, TelegramBotService],
})
export class CommunicationModule {}
