import { Body, Controller, Post } from '@nestjs/common';
import { UserInvitationService } from './user-invitation.service';

@Controller('user-invitations')
export class UserInvitationController {
  constructor(private readonly invitations: UserInvitationService) {}

  @Post('inspect')
  inspect(@Body() body: { token?: unknown }) {
    return this.invitations.inspect(body?.token);
  }

  @Post('accept')
  accept(@Body() body: { token?: unknown; password?: unknown }) {
    return this.invitations.accept(body || {});
  }
}
