import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type TransactionalEmailInput = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  tag?: string;
};

const DEFAULT_CLIENT_APP_URL = 'https://3001vaf-maker.github.io/Book';
const DEFAULT_SMTP_HOST = 'postbox.cloud.yandex.net';
const DEFAULT_SMTP_PORT = 465;

@Injectable()
export class TransactionalEmailService {
  async send(input: TransactionalEmailInput) {
    const provider = String(process.env.TRANSACTIONAL_EMAIL_PROVIDER || 'yandex-postbox').trim().toLowerCase();
    if (provider !== 'yandex-postbox') {
      throw new ServiceUnavailableException(`Неподдерживаемый провайдер транзакционной почты: ${provider}`);
    }

    const fromEmail = String(process.env.TRANSACTIONAL_EMAIL_FROM_EMAIL || '').trim().toLowerCase();
    const fromName = String(process.env.TRANSACTIONAL_EMAIL_FROM_NAME || 'Book').trim() || 'Book';
    const smtpUser = String(process.env.YANDEX_POSTBOX_SMTP_USER || '').trim();
    const smtpPassword = String(process.env.YANDEX_POSTBOX_SMTP_PASSWORD || '').trim();
    const smtpHost = String(process.env.YANDEX_POSTBOX_SMTP_HOST || DEFAULT_SMTP_HOST).trim();
    const smtpPort = Number(process.env.YANDEX_POSTBOX_SMTP_PORT || DEFAULT_SMTP_PORT);

    if (!fromEmail || !smtpUser || !smtpPassword || !smtpHost || !Number.isInteger(smtpPort) || smtpPort <= 0) {
      throw new ServiceUnavailableException('Транзакционная почта Book ещё не настроена');
    }

    const clientAppUrl = String(process.env.CLIENT_APP_URL || DEFAULT_CLIENT_APP_URL).trim().replace(/\/+$/, '');
    const frontendOrigin = String(process.env.FRONTEND_ORIGIN || '').trim().replace(/\/+$/, '');
    const inviteSource = frontendOrigin ? `${frontendOrigin}/invite/` : '';
    const inviteTarget = `${clientAppUrl}/invite/`;
    const html = input.tag === 'master-invitation' && inviteSource
      ? input.html.split(inviteSource).join(inviteTarget)
      : input.html;
    const text = input.tag === 'master-invitation' && input.text && inviteSource
      ? input.text.split(inviteSource).join(inviteTarget)
      : input.text;

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        minVersion: 'TLSv1.2',
      },
    });

    try {
      const result = await transport.sendMail({
        from: { address: fromEmail, name: fromName },
        to: [{ address: String(input.to || '').trim().toLowerCase(), name: String(input.toName || '').trim() }],
        subject: input.subject,
        html,
        text: text || undefined,
        headers: input.tag ? { 'X-Book-Tag': input.tag } : undefined,
      });

      if (!result.messageId) {
        throw new Error('SMTP-сервер не вернул идентификатор письма');
      }

      return { provider: 'yandex-postbox', messageId: result.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Почтовый сервис не отправил письмо';
      throw new BadGatewayException(message);
    }
  }
}
