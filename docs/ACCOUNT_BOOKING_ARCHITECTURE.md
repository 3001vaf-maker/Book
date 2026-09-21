# Global Account + Online Booking Architecture

Status: active implementation block, started 2026-09-21.

This file is the continuity anchor for the end-human Account/Profile and public online-booking flow. Do not replace this model with a tenant-scoped account or a channel-specific registration path.

## Terminology

- Account / Profile: the human's own platform identity.
- Person: the representation of that human inside one concrete Tenant's People dataset.
- Tenant: one Tenant container.
- Entry channel: web link, Telegram Mini App, or a future channel. A channel is transport/context only; it never owns identity or legal rules.
- Do not rename the global human Account/Profile to Person.

## Hard invariants

### One global Account/Profile

Account/Profile is global across the whole platform, not owned by a Tenant.

Every concrete contact is globally unique across Accounts:
- phone;
- email;
- stable Telegram user ID.

A contact already owned by one Account cannot create or attach to a second Account.

Telegram username is not an identity key. Telegram user ID is technical and is never manually typed by the human.

All entry channels resolve the same Account/Profile:
web link == Telegram Mini App == future entry channel.

### Tenant Person remains independent

Each Tenant owns its own Person records.

The same Account may be linked to one Person in Tenant A and another Person in Tenant B.

Allowed synchronization:
Account/Profile -> already linked Person(s).

Forbidden automatic synchronization:
Person -> Account/Profile;
Person in Tenant A -> Person in Tenant B.

The system must never copy a Tenant's privately stored contact into the human's global Profile automatically.

### Booking intent comes before identity

A Tenant's public link means: the human intends to book.

Canonical public flow:

welcome -> workplace when not fixed by link -> services -> date -> time -> final identity/legal gate -> confirmation

Registration/login must not be an entrance barrier before service/date/time selection.

If a workplace is fixed by the incoming link, the workplace step is skipped.

Back from the first visible booking step does not reveal skipped link parameters. It exits the booking flow to Profile. If Account is not currently authenticated, authenticate first and then open Profile.

### Session rule

If the device already has a valid Account session, do not ask for login/password again.

The Account session is global, not tenant-scoped. Changing Tenant/Tenant or entry channel must not create a second session or second Account.

### Final identity/legal gate

After the human has chosen the booking and before a real Record is created:

1. If Account/Profile is already authenticated, do not show login/registration.
2. If Account is not authenticated, offer login or account creation.
3. New Account creation requires acceptance of the platform-neutral "Условия использования учетной записи".
4. After Account is resolved, check the current Tenant's required Person consent.
5. Tenant marketing consent is separate and optional.
6. After required legal state is valid, create/confirm the booking without losing the selected workplace/services/date/time.

Platform Account terms and Tenant Person consent are different legal contours and different event stores.

## Platform terms

The end-human document is neutral and must not depend on the current technical product name.

Canonical title:
"Условия использования учетной записи"

Brand-only/editorial changes must not automatically force re-acceptance. Material contract changes use a new version and can require a new acceptance.

Acceptance is platform-global and belongs to:
Account + PlatformDocumentVersion + event time/source/evidence.

It must not be stored as TenantConsentEvent.

## Tenant consent

Tenant consent belongs to:
Account + Tenant + tenant document/version.

It does not control access to the human's own Profile.

For a concrete Tenant:
- current accepted version -> continue;
- missing/revoked/new required version -> show consent before final booking;
- changes for one Tenant do not affect another Tenant.

## Person resolution

When an Account first interacts with a Tenant:

1. existing Account->Person binding wins;
2. otherwise compare the Account's available contacts against that Tenant's People as a group;
3. if all matches resolve to one Person, bind and enrich that Person with contacts supplied by the Account;
4. if contacts conflict across different Persons, do not auto-merge or choose a physical identity for the Tenant; preserve ambiguity for later explicit resolution;
5. if there is no match, create a new Person and bind it.

UEI is tenant-internal identity-management state. It is not the global Account ID and must not be exposed as the human's Profile identity.

## Welcome

Welcome belongs to the Tenant/Tenant.

Settings already own welcomeTitle/welcomeText. Later UI polish may replace the current shared header presentation with a clean welcome page. That cosmetic change is separate from this architecture block.

Welcome -> booking. Never Welcome -> registration.

## Implementation chain

A0 DONE: architecture/continuity anchor.

A1 PENDING: global Account identity, global contact uniqueness, global session, shared link/Mini App identity resolution.

A2 PENDING: reorder public booking so anonymous selection happens before identity/legal gate and selected booking survives auth/legal steps.

A3 PENDING: platform-neutral Account Terms document + append-only global Account acceptance; keep Tenant consent separate.

A4 PENDING: Person matching/enrichment using Account contacts; enforce one-way Account -> linked Person contact propagation.

A5 PENDING: guards/tests, migration/build, full Check Book, staging verification.

## Release rule

Work only on feature branch -> PR to staging -> Check Book -> staging verification.

Do not merge this block to main directly.
