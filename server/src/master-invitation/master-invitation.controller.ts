import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { MasterInvitationService } from './master-invitation.service';

@Controller('master-invitations')
export class MasterInvitationController {
  constructor(
    private readonly invitations: MasterInvitationService,
    private readonly legal: LegalRuntimeService,
  ) {}

  @Post('inspect')
  inspect(@Body() body: { token?: unknown }) {
    return this.invitations.inspect(body?.token);
  }

  @Post('documents')
  async documents() {
    await this.legal.assertPlatformLegalReady('');
    const documents = await this.legal.listDocuments('PLATFORM', null);
    return documents.filter((item) => item.currentVersion).map((item) => ({
      key: item.key,
      type: item.type,
      title: item.title,
      requiredForRegistration: item.requiredForRegistration,
      version: item.currentVersion!.version,
      content: item.currentVersion!.contentSnapshot,
      contentHash: item.currentVersion!.contentHash,
      operatorIdentity: item.currentVersion!.operatorIdentitySnapshot,
      publishedAt: item.currentVersion!.publishedAt,
    }));
  }

  @Post('accept')
  accept(
    @Req() request: Request,
    @Body() body: {
      token?: unknown;
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
      // The current acceptance service stores separate evidence rows for the
      // SaaS agreement and DPA against their own document-version IDs. Keep
      // the existing service contract fail-closed by passing its shared
      // agreement flag only when both visible confirmations were given.
      saasAgreementAccepted: body?.saasAgreementAccepted === true && body?.dpaAccepted === true,
      technicalEvidence: {
        ip: request.ip || '',
        userAgent: request.headers['user-agent'] || '',
      },
    });
  }
}
