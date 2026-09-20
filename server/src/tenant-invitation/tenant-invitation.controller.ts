import { Body, Controller, Post } from '@nestjs/common';
import { TenantInvitationService } from './tenant-invitation.service';

@Controller('tenant-invitations')
export class TenantInvitationController {
  constructor(private readonly invitations: TenantInvitationService) {}

  @Post('inspect')
  inspect(@Body() body: { token?: unknown }) {
    return this.invitations.inspect(body?.token);
  }

  @Post('accept')
  accept(@Body() body: { token?: unknown; password?: unknown }) {
    return this.invitations.accept(body || {});
  }

  @Post('registration-link/inspect')
  inspectRegistrationLink(@Body() body: { token?: unknown }) {
    return this.invitations.inspectRegistrationLink(body?.token);
  }

  @Post('registration-link/accept')
  acceptRegistrationLink(@Body() body: { token?: unknown; email?: unknown; password?: unknown }) {
    return this.invitations.acceptRegistrationLink(body || {});
  }
}
