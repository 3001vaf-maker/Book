import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

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
  private client() {
    const accessKeyId = String(process.env.YANDEX_POSTBOX_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = String(process.env.YANDEX_POSTBOX_SECRET_ACCESS_KEY || '').trim();
    if (!accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException('Yandex Cloud Postbox ещё не настроен');
    }

    return new SESv2Client({
      region: String(process.env.YANDEX_POSTBOX_REGION || 'ru-central1').trim() || 'ru-central1',
      endpoint: 'https://postbox.cloud.yandex.net',
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async send(input: TransactionalEmailInput) {
    const provider = String(process.env.TRANSACTIONAL_EMAIL_PROVIDER || 'yandex-postbox').trim().toLowerCase();
    if (provider !== 'yandex-postbox') {
      throw new ServiceUnavailableException(`Неподдерживаемый провайдер транзакционной почты: ${provider}`);
    }

    const fromEmail = String(process.env.TRANSACTIONAL_EMAIL_FROM_EMAIL || '').trim().toLowerCase();
    const fromName = String(process.env.TRANSACTIONAL_EMAIL_FROM_NAME || 'Book').trim() || 'Book';
    if (!fromEmail) throw new ServiceUnavailableException('Email отправителя Book ещё не настроен');

    try {
      const result = await this.client().send(new SendEmailCommand({
        FromEmailAddress: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        Destination: {
          ToAddresses: [String(input.to || '').trim().toLowerCase()],
        },
        EmailTags: input.tag ? [{ Name: 'book-purpose', Value: input.tag }] : undefined,
        Content: {
          Simple: {
            Subject: { Data: input.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: input.html, Charset: 'UTF-8' },
              Text: input.text ? { Data: input.text, Charset: 'UTF-8' } : undefined,
            },
          },
        },
      }));

      if (!result.MessageId) throw new BadGatewayException('Yandex Cloud Postbox не вернул идентификатор письма');
      return { provider: 'yandex-postbox', messageId: result.MessageId };
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error;
      throw new BadGatewayException(error instanceof Error ? error.message : 'Yandex Cloud Postbox не отправил письмо');
    }
  }
}
