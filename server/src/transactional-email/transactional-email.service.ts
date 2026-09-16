import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

type TransactionalEmailInput = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  tag?: string;
};

type BrevoResponse = {
  messageId?: string;
  message?: string;
  code?: string;
};

@Injectable()
export class TransactionalEmailService {
  async send(input: TransactionalEmailInput) {
    const provider = String(process.env.TRANSACTIONAL_EMAIL_PROVIDER || 'brevo').trim().toLowerCase();

    if (provider === 'staging-memory') {
      if (String(process.env.NODE_ENV || '').trim().toLowerCase() !== 'staging') {
        throw new ServiceUnavailableException('staging-memory transport запрещён вне staging');
      }
      return {
        provider: 'staging-memory',
        messageId: `staging-${randomUUID()}`,
        to: String(input.to || '').trim().toLowerCase(),
      };
    }

    if (provider !== 'brevo') {
      throw new ServiceUnavailableException(`Неподдерживаемый провайдер транзакционной почты: ${provider}`);
    }

    const apiKey = String(process.env.BREVO_API_KEY || '').trim();
    const fromEmail = String(process.env.TRANSACTIONAL_EMAIL_FROM_EMAIL || '').trim().toLowerCase();
    const fromName = String(process.env.TRANSACTIONAL_EMAIL_FROM_NAME || 'Book').trim() || 'Book';
    if (!apiKey || !fromEmail) {
      throw new ServiceUnavailableException('Транзакционная почта Book ещё не настроена');
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: String(input.to || '').trim().toLowerCase(), name: String(input.toName || '').trim() }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text || undefined,
        tags: input.tag ? [input.tag] : undefined,
      }),
    });

    const payload = await response.json().catch(() => ({})) as BrevoResponse;
    if (!response.ok || !payload.messageId) {
      throw new BadGatewayException(payload.message || 'Провайдер не отправил письмо');
    }

    return { provider: 'brevo', messageId: payload.messageId };
  }
}
