import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunicationBroadcastService } from './communication-broadcast.service';
import { CommunicationDispatchService } from './communication-dispatch.service';
import { CommunicationHistoryService } from './communication-history.service';
import { ProfessionalEmailService } from './professional-email.service';
import { TelegramBotService } from './telegram-bot.service';

type OwnerRequest = Request & { auth?: { platformAccountId: string; tenantId: string; role: string } };

function professionalAppOrigin() {
  const fallback = process.env.NODE_ENV === 'production'
    ? 'https://book.va-tools.ru'
    : String(process.env.FRONTEND_ORIGIN || 'http://localhost:8080').trim();
  try { return new URL(fallback).origin; } catch { return ''; }
}

function emailOAuthPage(success: boolean) {
  const origin = professionalAppOrigin();
  const payload = JSON.stringify({ type: 'va-tools:email-integration', connected: success });
  const target = JSON.stringify(origin);
  const title = success ? 'Почта подключена' : 'Не удалось подключить почту';
  const text = success ? 'Почта подключена. Вернитесь в приложение.' : 'Подключение не завершено. Вернитесь в приложение и попробуйте ещё раз.';
  const notify = origin ? `if (window.opener) window.opener.postMessage(${payload}, ${target});` : '';
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${title}</title><body><p>${text}</p><script>${notify}${success ? 'setTimeout(() => window.close(), 120);' : ''}</script></body></html>`;
}

@Controller('communications')
export class CommunicationController {
  constructor(
    private readonly telegramBots: TelegramBotService,
    private readonly professionalEmail: ProfessionalEmailService,
    private readonly history: CommunicationHistoryService,
    private readonly dispatch: CommunicationDispatchService,
    private readonly broadcasts: CommunicationBroadcastService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('integrations/email')
  emailConnection(@Req() request: OwnerRequest) {
    return this.professionalEmail.connectionStatus(request.auth!.tenantId, request.auth!.platformAccountId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('integrations/email/connect')
  connectEmail(@Req() request: OwnerRequest, @Body() body: { email?: unknown }) {
    return this.professionalEmail.beginConnection(request.auth!.tenantId, request.auth!.platformAccountId, body?.email);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('integrations/email')
  disconnectEmail(@Req() request: OwnerRequest) {
    return this.professionalEmail.disconnect(request.auth!.tenantId, request.auth!.platformAccountId);
  }

  @Get('integrations/email/oauth/yandex/callback')
  async emailOAuthCallback(
    @Query('state') state: string,
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() response: Response,
  ) {
    let success = false;
    try {
      await this.professionalEmail.completeYandexConnection(state, code, error);
      success = true;
    } catch {}
    response.status(success ? 200 : 400).type('html').send(emailOAuthPage(success));
  }

  @UseGuards(JwtAuthGuard)
  @Get('integrations/telegram')
  telegramConnection(@Req() request: OwnerRequest) { return this.telegramBots.getConnection(request.auth!.tenantId); }

  @UseGuards(JwtAuthGuard)
  @Put('integrations/telegram')
  connectTelegram(@Req() request: OwnerRequest, @Body() body: { token?: unknown }) { return this.telegramBots.connect(request.auth!.tenantId, body?.token); }

  @UseGuards(JwtAuthGuard)
  @Post('integrations/telegram/repair')
  repairTelegram(@Req() request: OwnerRequest) { return this.telegramBots.repairConnection(request.auth!.tenantId); }

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
  @Get('chat/channels')
  async chatChannels(@Req() request: OwnerRequest, @Query('phone') phone = '', @Query('uei') uei = '') {
    return { channels: await this.dispatch.availableChannels(request.auth!.tenantId, { phone, uei }) };
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
  sendChatMessage(@Req() request: OwnerRequest, @Body() body: { channel?: unknown; phone?: unknown; uei?: unknown; body?: unknown; attachments?: unknown }) {
    return this.dispatch.send(request.auth!.tenantId, { ...(body || {}), purpose: 'DIRECT' });
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
