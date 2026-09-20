import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';

type TransactionalEmailInput = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  tag?: string;
};

@Injectable()
export class TransactionalEmailService {
  private readonly logger = new Logger(TransactionalEmailService.name);

  private transporter() {
    const apiKeyId = String(process.env.POSTBOX_API_KEY_ID || '').trim();
    const apiKeySecret = String(process.env.POSTBOX_API_KEY_SECRET || '').trim();
    if (!apiKeyId || !apiKeySecret) {
      throw new ServiceUnavailableException('Почтовый канал ещё не настроен');
    }

    return nodemailer.createTransport({
      host: 'postbox.cloud.yandex.net',
      port: 587,
      secure: false,
      requireTLS: true,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
      auth: {
        user: apiKeyId,
        pass: apiKeySecret,
      },
    });
  }

  async send(input: TransactionalEmailInput) {
    const provider = String(process.env.TRANSACTIONAL_EMAIL_PROVIDER || 'yandex-postbox').trim().toLowerCase();
    if (provider !== 'yandex-postbox') {
      throw new ServiceUnavailableException(`Неподдерживаемый провайдер транзакционной почты: ${provider}`);
    }

    const fromEmail = String(process.env.TRANSACTIONAL_EMAIL_FROM_EMAIL || '').trim().toLowerCase();
    const fromName = String(process.env.TRANSACTIONAL_EMAIL_FROM_NAME || '').trim();
    if (!fromEmail) throw new ServiceUnavailableException('Email отправителя ещё не настроен');

    try {
      const result = await this.transporter().sendMail({
        from: fromName ? { address: fromEmail, name: fromName } : fromEmail,
        to: input.toName
          ? { address: String(input.to || '').trim().toLowerCase(), name: input.toName }
          : String(input.to || '').trim().toLowerCase(),
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: input.tag ? { 'X-Message-Tag': input.tag } : undefined,
      });

      if (!result.messageId) throw new BadGatewayException('Cloud Postbox не вернул идентификатор письма');
      return { provider: 'yandex-postbox', messageId: result.messageId };
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error;

      const details = error && typeof error === 'object'
        ? {
            name: 'name' in error ? String(error.name || '') : '',
            code: 'code' in error ? String(error.code || '') : '',
            command: 'command' in error ? String(error.command || '') : '',
            responseCode: 'responseCode' in error ? String(error.responseCode || '') : '',
            response: 'response' in error ? String(error.response || '') : '',
            message: 'message' in error ? String(error.message || '') : '',
          }
        : { message: String(error || '') };

      this.logger.error(`Postbox send failed: ${JSON.stringify(details)}`);
      const message = details.message || details.response || 'Cloud Postbox не отправил письмо';
      throw new BadGatewayException(message);
    }
  }
}
