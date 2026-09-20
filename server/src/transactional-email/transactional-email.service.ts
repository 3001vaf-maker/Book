import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
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
  private transporter() {
    const user = String(process.env.YANDEX_SMTP_USER || '').trim().toLowerCase();
    const pass = String(process.env.YANDEX_SMTP_APP_PASSWORD || '').trim();
    if (!user || !pass) {
      throw new ServiceUnavailableException('Яндекс Почта Book ещё не настроена');
    }

    return nodemailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }

  async send(input: TransactionalEmailInput) {
    const provider = String(process.env.TRANSACTIONAL_EMAIL_PROVIDER || 'yandex-mail').trim().toLowerCase();
    if (provider !== 'yandex-mail') {
      throw new ServiceUnavailableException(`Неподдерживаемый провайдер транзакционной почты: ${provider}`);
    }

    const smtpUser = String(process.env.YANDEX_SMTP_USER || '').trim().toLowerCase();
    const fromEmail = String(process.env.TRANSACTIONAL_EMAIL_FROM_EMAIL || smtpUser).trim().toLowerCase();
    const fromName = String(process.env.TRANSACTIONAL_EMAIL_FROM_NAME || 'Book').trim() || 'Book';
    if (!fromEmail) throw new ServiceUnavailableException('Email отправителя Book ещё не настроен');

    try {
      const result = await this.transporter().sendMail({
        from: { address: fromEmail, name: fromName },
        to: input.toName
          ? { address: String(input.to || '').trim().toLowerCase(), name: input.toName }
          : String(input.to || '').trim().toLowerCase(),
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: input.tag ? { 'X-Book-Tag': input.tag } : undefined,
      });

      if (!result.messageId) throw new BadGatewayException('Яндекс Почта не вернула идентификатор письма');
      return { provider: 'yandex-mail', messageId: result.messageId };
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error;
      throw new BadGatewayException(error instanceof Error ? error.message : 'Яндекс Почта не отправила письмо');
    }
  }
}
