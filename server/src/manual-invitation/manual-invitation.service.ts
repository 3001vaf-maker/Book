import { Injectable } from '@nestjs/common';
import { TenantInvitationService } from '../tenant-invitation/tenant-invitation.service';

@Injectable()
export class ManualInvitationService {
  constructor(private readonly invitations: TenantInvitationService) {}

  create(adminId: string) {
    return this.invitations.createRegistrationLink(adminId);
  }

  inspect(token: unknown) {
    return this.invitations.inspectRegistrationLink(token);
  }

  accept(input: { token?: unknown; email?: unknown; password?: unknown }) {
    return this.invitations.acceptRegistrationLink(input || {});
  }
}
