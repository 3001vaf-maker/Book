import { Body, Controller, Post } from '@nestjs/common';
import { MasterInvitationService } from './master-invitation.service';

@Controller('master-invitations')
export class MasterInvitationController {
  constructor(private readonly invitations: MasterInvitationService) {}

  @Post('inspect')
  inspect(@Body() body: { token?: unknown }) {
    return this.invitations.inspect(body?.token);
  }

  @Post('accept')
  accept(@Body() body: { token?: unknown; password?: unknown }) {
    return this.invitations.accept(body || {});
  }
}
