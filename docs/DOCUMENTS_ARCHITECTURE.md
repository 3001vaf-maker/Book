# Book — Documents / Consents architecture

## 1. Owner

`Documents` is the only owner of documents, document versions, consent events, current consent state and consent reporting.

The `Clients / People` domain does **not** own consent state. A client card may only display a projection calculated from Documents.

Canonical direction:

```text
Documents
  ├─ document
  ├─ document version
  ├─ append-only consent event
  ├─ current consent projection
  └─ reports
          ↓ projection
Clients / People
```

A checkbox or `person.agreements` field is never a source of truth. Legacy agreement flags may be read only as migration input and must not become a second owner.

## 2. Consent subject — fixed rule

Consent is never owned by a mutable Client/Person card and never by UEI.

There are exactly two canonical consent subjects:

- `BOOKING_ACCOUNT` — stable client account identity. Used for documents required to enter/use the client account.
- `CONTACT_POINT` — exact verified destination such as phone, email or Telegram user id. Used for permission to send messages to that destination.

`clientId` / `Person.key` is **not a consent subject**. It is historical migration input only. New consent code must not write or authorize from `clientId`.

UEI may join or detach Person records, change the visible owner card or hide a duplicate. None of those operations may create, remove, transfer or invalidate a consent event.

Canonical examples:

```text
BOOKING_ACCOUNT
subjectKey = <BookingAccount.id>
document = pdn-consent

CONTACT_POINT
contactType = TELEGRAM
contactValue = <verified Telegram user id>
document = messages-consent
```

SMS and WhatsApp use the canonical `PHONE` Contact Point because the destination is the same normalized telephone number. Channel choice is separate from contact-point identity.

## 3. Consent event log

Consent history is an append-only server event log. Every event contains:
- tenant;
- canonical subject type and stable subject key;
- Contact Point type/value when the subject is `CONTACT_POINT`;
- document id;
- document version;
- action/status: `accepted` / `revoked` / `declined` when applicable;
- exact event timestamp;
- source/channel;
- migration provenance when an old event was converted.

Revocation never deletes the earlier acceptance. Re-acceptance creates a new event. Current state is derived from the latest valid event for the same canonical subject and document/version.

Historical JSON events tied to `clientId` are converted one time into canonical server events. Their original status, document version, source and timestamps are preserved. Migration must never create a fake new acceptance dated today.

The original legacy facts may remain archived for audit, but they are never consulted to authorize access or messaging after canonical migration.

## 4. Required consent and access

A document marked as required for client access is evaluated against `BOOKING_ACCOUNT`.

If the current required consent is absent or revoked:
- credentials may be recognized, but the client area is not opened where that document is required;
- the user is sent to the required documents/consent step;
- access resumes only after a new `accepted` event is recorded for the current required document version and the same BookingAccount.

Changing a required document version may require a new consent according to the document rule; an old-version acceptance must not silently satisfy a new required version.

## 5. Messaging consent

`messages-consent` permission is evaluated only against the exact `CONTACT_POINT` that will receive the message.

Examples:
- Telegram send → check the verified Telegram user id;
- email send → check the normalized email;
- SMS / WhatsApp send → check the normalized phone Contact Point.

If the current messaging consent for that destination is not `accepted`:
- no outbound message is sent to that destination;
- revocation stops future sends immediately;
- consent on another Contact Point does not silently authorize this one;
- client access itself is not blocked solely because messaging consent is absent or revoked.

When a client explicitly links a new verified communication Contact Point while their account-level `messages-consent` is currently accepted, Book records a separate Contact Point event for that newly linked destination. Permission is still stored and checked on the Contact Point itself.

Before every send, the messaging/notification subsystem must query the current consent projection from Documents. It must not trust cached flags in Client, Person, UEI or BookingAccount.

## 6. Client projection

The client list/card may display only derived information from Documents, for example:
- consent present / absent / revoked;
- document name and version;
- date/time of the current event;
- link to the full consent history.

For a merged UEI identity, the UI may aggregate projections from member BookingAccounts and Contact Points for display only. That aggregation does not change ownership of any consent event.

The client UI does not write its own agreement flags. Any accept/revoke action writes a Documents event, after which the client projection refreshes.

## 7. Reporting

Reports are built from the canonical Documents event log, not from Client fields, UEI, BookingAccount cached checkboxes or browser state.

The report must be able to answer:
- canonical subject;
- exact Contact Point when applicable;
- which document;
- which version;
- accepted / revoked / declined;
- exact date and time;
- source/channel;
- current state;
- full event chain;
- original legacy event reference for migrated history.

## 8. Server ownership

The production server/PostgreSQL owns document and consent business data. Browser state is never the legal/audit source.

Consent events live in a dedicated append-only relational server store. The old mutable JSON consent array is legacy migration input only and is not updated by current product flows.

## 9. Integration boundaries

`Online Booking` may request Documents to validate required account consent and record consent events, but it does not own consent history.

`Clients / People` may request Documents for projections, but it does not own consent history.

`UEI` groups People for identity/display purposes but never owns or moves consent.

`Notifications / SMS / Telegram / Chat` must request Documents for the current Contact Point permission before sending.

One domain owner: **Documents**.
