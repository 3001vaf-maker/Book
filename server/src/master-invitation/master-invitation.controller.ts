import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { MasterInvitationService } from './master-invitation.service';

@Controller('master-invitations')
export class MasterInvitationController {
  constructor(
    private readonly invitations: MasterInvitationService,
  ) {}

  @Post('inspect')
  inspect(@Body() body: { token?: unknown }) {
    return this.invitations.inspect(body?.token);
  }

  @Post('documents')
  documents() {
    return this.invitations.publishedPlatformDocuments();
  }

  @Post('accept')
  accept(
    @Req() request: Request,
    @Body() body: {
      token?: unknown;
      name?: unknown;
      surname?: unknown;
      phone?: unknown;
      email?: unknown;
      password?: unknown;
      saasAgreementAccepted?: unknown;
      dpaAccepted?: unknown;
      privacyAcknowledged?: unknown;
      pdConsentAccepted?: unknown;
      marketingConsentAccepted?: unknown;
    },
  ) {
    return this.invitations.accept({
      ...(body || {}),
      technicalEvidence: {
        ip: request.ip || '',
        userAgent: request.headers['user-agent'] || '',
      },
    });
  }
}
