# Book — Documents / Consents architecture

## 1. Owner

`Documents` is the only owner of documents, document versions, consent events and consent reporting.

The `Clients / People` domain does **not** own consent state. A client card may only display a projection calculated from Documents.

Canonical direction:

```text
Documents
  ├─ document
  ├─ document version
  ├─ consent event log
  ├─ current consent state
  └─ reports
          ↓ projection
Clients / People
```

A checkbox or `person.agreements` field is never a source of truth. Legacy agreement flags may be read only as migration input and must not become a second owner.

## 2. Consent event log

Every action is an immutable event tied to:
- tenant;
- Person / UEI;
- document id;
- document version;
- action: `accepted` / `revoked` / `declined` when applicable;
- exact timestamp;
- source/channel.

Revocation never deletes the earlier acceptance. Re-acceptance creates a new event. Current state is derived from the latest valid event for the relevant document/version.

## 3. Required consent and access

A document marked as required for client access is an access prerequisite.

If the current required consent is absent or revoked:
- credentials may be recognized, but the client area is not opened;
- the user is sent to the required documents/consent step;
- access resumes only after a new `accepted` event is recorded for the current required document version.

Changing a required document version may require a new consent according to the document rule; an old-version acceptance must not silently satisfy a new required version.

## 4. Messaging consent

`messages-consent` is independent from the required access consent.

If the current messaging consent is not `accepted`:
- no SMS or other outbound client notifications are sent through channels governed by this consent;
- revocation stops future sends immediately;
- client access itself is not blocked solely because messaging consent is absent or revoked.

Before every send, the messaging/notification subsystem must query the current consent projection from Documents. It must not trust cached flags in Client or BookingAccount.

## 5. Client projection

The client list/card may display only derived information from Documents, for example:
- consent present / absent / revoked;
- document name and version;
- date/time of the current event;
- link to the full consent history.

The client UI does not write its own agreement flags. Any accept/revoke action writes a Documents event, after which the client projection refreshes.

## 6. Reporting

Reports are built from the Documents event log, not from Client fields and not from the current checkbox state.

The report must be able to answer:
- who;
- which document;
- which version;
- accepted / revoked / declined;
- exact date and time;
- source/channel;
- current state;
- full event chain.

## 7. Server ownership

The production server/PostgreSQL owns document and consent business data. Browser state is never the legal/audit source.

For scale and auditability, consent history must behave as append-only business facts. Replacing an entire mutable JSON array is not the target architecture for the final server model.

## 8. Integration boundaries

`Online Booking` may request Documents to validate required consent and record consent events, but it does not own consent history.

`Clients / People` may request Documents for projections, but it does not own consent history.

`Notifications / SMS / Telegram` must request Documents for the current messaging permission before sending.

One domain owner: **Documents**.