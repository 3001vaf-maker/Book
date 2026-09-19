import { Body, Controller, Post } from '@nestjs/common';
import { InvitationService } from './invitation.service';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}

  @Post('inspect')
  inspect(@Body() body: { token?: unknown }) {
    return this.invitations.inspect(body?.token);
  }

  @Post('accept')
  accept(@Body() body: { token?: unknown; password?: unknown }) {
    return this.invitations.accept(body || {});
  }
}
