import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunicationBroadcastService } from './communication-broadcast.service';
import { CommunicationDispatchService } from './communication-dispatch.service';
import { CommunicationHistoryService } from './communication-history.service';
import { CommunicationService } from './communication.service';
import { TelegramBotService } from './telegram-bot.service';

type OwnerRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('communications')
export class CommunicationController {
  constructor(
    private readonly telegramBots: TelegramBotService,
    private readonly communications: CommunicationService,
    private readonly history: CommunicationHistoryService,
    private readonly dispatch: CommunicationDispatchService,
    private readonly broadcasts: CommunicationBroadcastService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('integrations/telegram')
  telegramConnection(@Req() request: OwnerRequest) { return this.telegramBots.getConnection(request.auth!.tenantId); }

  @UseGuards(JwtAuthGuard)
  @Put('integrations/telegram')
  connectTelegram(@Req() request: OwnerRequest, @Body() body: { token?: unknown }) { return this.telegramBots.connect(request.auth!.tenantId, body?.token); }

  @UseGuards(JwtAuthGuard)
  @Delete('integrations/telegram')
  disconnectTelegram(@Req() request: OwnerRequest) { return this.telegramBots.disconnect(request.auth!.tenantId); }

  @UseGuards(JwtAuthGuard)
  @Get('chat/threads')
  chatThreads(@Req() request: OwnerRequest, @Query('limit') limit = '200') { return this.history.listThreads(request.auth!.tenantId, Number(limit)); }

  @UseGuards(JwtAuthGuard)
  @Get('chat/thread')
  chatThread(@Req() request: OwnerRequest, @Query('phone') phone = '', @Query('uei') uei = '', @Query('limit') limit = '300') {
    return this.history.listThread(request.auth!.tenantId, { phone, uei }, Number(limit));
  }

  @UseGuards(JwtAuthGuard)
  @Get('chat/preferences')
  chatPreferences(@Req() request: OwnerRequest, @Query('phone') phone = '', @Query('uei') uei = '') {
    return this.history.getPreferences(request.auth!.tenantId, { phone, uei });
  }

  @UseGuards(JwtAuthGuard)
  @Put('chat/preferences')
  saveChatPreferences(@Req() request: OwnerRequest, @Body() body: { phone?: unknown; uei?: unknown; preferredChannels?: unknown }) {
    return this.history.savePreferences(request.auth!.tenantId, body || {});
  }

  @UseGuards(JwtAuthGuard)
  @Post('chat/messages')
  sendChatMessage(@Req() request: OwnerRequest, @Body() body: { channel?: unknown; phone?: unknown; uei?: unknown; body?: unknown; content?: unknown; attachments?: unknown }) {
    return this.dispatch.send(request.auth!.tenantId, body || {});
  }

  @UseGuards(JwtAuthGuard)
  @Patch('chat/messages/:messageId')
  editChatMessage(@Req() request: OwnerRequest, @Param('messageId') messageId: string, @Body() body: { body?: unknown; content?: unknown }) {
    return this.communications.editMessage(request.auth!.tenantId, messageId, { side: 'master' }, body || {});
  }

  @UseGuards(JwtAuthGuard)
  @Delete('chat/messages/:messageId')
  deleteChatMessage(@Req() request: OwnerRequest, @Param('messageId') messageId: string) {
    return this.communications.deleteMessage(request.auth!.tenantId, messageId, { side: 'master' });
  }

  @UseGuards(JwtAuthGuard)
  @Get('broadcasts/templates')
  broadcastTemplates(@Req() request: OwnerRequest) { return this.broadcasts.listTemplates(request.auth!.tenantId); }

  @UseGuards(JwtAuthGuard)
  @Post('broadcasts/templates')
  saveBroadcastTemplate(@Req() request: OwnerRequest, @Body() body: { id?: unknown; name?: unknown; body?: unknown }) {
    return this.broadcasts.saveTemplate(request.auth!.tenantId, body || {});
  }

  @UseGuards(JwtAuthGuard)
  @Delete('broadcasts/templates/:id')
  deleteBroadcastTemplate(@Req() request: OwnerRequest, @Param('id') id: string) { return this.broadcasts.deleteTemplate(request.auth!.tenantId, id); }

  @UseGuards(JwtAuthGuard)
  @Get('broadcasts/groups')
  broadcastGroups(@Req() request: OwnerRequest) { return this.broadcasts.listGroups(request.auth!.tenantId); }

  @UseGuards(JwtAuthGuard)
  @Post('broadcasts/groups')
  saveBroadcastGroup(@Req() request: OwnerRequest, @Body() body: { id?: unknown; name?: unknown; personKeys?: unknown }) {
    return this.broadcasts.saveGroup(request.auth!.tenantId, body || {});
  }

  @UseGuards(JwtAuthGuard)
  @Delete('broadcasts/groups/:id')
  deleteBroadcastGroup(@Req() request: OwnerRequest, @Param('id') id: string) { return this.broadcasts.deleteGroup(request.auth!.tenantId, id); }

  @UseGuards(JwtAuthGuard)
  @Post('broadcasts/preview')
  previewBroadcast(@Req() request: OwnerRequest, @Body() body: { channel?: unknown; all?: unknown; phones?: unknown; personKeys?: unknown; groupId?: unknown }) {
    return this.broadcasts.preview(request.auth!.tenantId, body || {});
  }

  @UseGuards(JwtAuthGuard)
  @Post('broadcasts/send')
  sendBroadcast(@Req() request: OwnerRequest, @Body() body: { channel?: unknown; all?: unknown; phones?: unknown; personKeys?: unknown; groupId?: unknown; name?: unknown; body?: unknown }) {
    return this.broadcasts.send(request.auth!.tenantId, body || {});
  }

  @Post('telegram/webhook/:webhookKey')
  telegramWebhook(@Param('webhookKey') webhookKey: string, @Headers('x-telegram-bot-api-secret-token') secretToken: string, @Body() update: Record<string, any>) {
    return this.telegramBots.handleWebhook(webhookKey, secretToken, update || {});
  }
}
