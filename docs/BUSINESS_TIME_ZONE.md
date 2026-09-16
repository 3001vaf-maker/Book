# Business time zone

Book stores the business time zone as an IANA identifier per tenant.

## Registration contract

- During the first working-profile bootstrap the browser reads `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- `/profile/bootstrap` sends that value to the server automatically; the master does not type a time zone during registration.
- The first valid value is persisted for the tenant and is not overwritten by later employee/profile bootstraps.
- Existing production tenants keep `Europe/Moscow` during migration so current behavior does not change unexpectedly.
- `BOOK_TIME_ZONE` remains only a server fallback when no valid persisted tenant zone can be read.

## Runtime contract

All server-side appointment scheduling that depends on local clock time, including visit reminders, must resolve the tenant time zone. Server-host time must never be treated as the business time zone.

A future business settings screen may allow the owner/admin to change the stored zone deliberately. For networks operating in multiple time zones, a workplace-level override can be added later; tenant time zone remains the default.
