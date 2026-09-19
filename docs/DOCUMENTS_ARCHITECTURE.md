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

## 3. PDN consent and grey zone

`pdn-consent` controls active cooperation with the profile. Revocation does not delete the account, client history, booking history, notifications or consent history.

When the current `pdn-consent` is absent or revoked:
- login remains available;
- consent documents and consent management remain available;
- booking/request history created before revocation remains readable;
- notifications created before revocation remain readable and may be marked read;
- creating a new booking/request is blocked;
- Chat is unavailable: no new `DIRECT` messages are read, written or delivered;
- new `SYSTEM`, `SERVICE`, `DIRECT` and `MARKETING` deliveries are blocked at send time;
- `MARKETING` additionally requires its own advertising consent.

Re-accepting the current `pdn-consent` returns the account to active cooperation. Changing the PDN document version requires acceptance of the current version before active cooperation resumes.

Data deletion/anonymisation is a separate process and is not triggered by consent revocation.

## 4. Marketing consent and message purpose

`messages-consent` is the current technical id of the advertising/marketing consent. It applies only to messages whose persisted `purpose` is `MARKETING`.

Client-facing message purposes are independent of delivery channel:
- `SYSTEM` — account, security and technical access/linking;
- `SERVICE` — booking/service execution and operational notifications;
- `DIRECT` — person-to-person chat between the business and the client;
- `MARKETING` — advertising, promotions, free slots and broadcasts.

`SYSTEM`, `SERVICE` and `DIRECT` must never be blocked by `messages-consent`.

Before every `MARKETING` send, the communication subsystem must query the current advertising consent for the target contact/channel. Revocation stops subsequent `MARKETING` sends for that target. Cached flags in Client or BookingAccount are not the source of truth.

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

`Notifications / SMS / Telegram` must first require active `pdn-consent` for every new `SYSTEM`, `SERVICE`, `DIRECT` or `MARKETING` communication. Only `MARKETING` additionally requests the advertising consent represented by `messages-consent`.

One domain owner: **Documents**.