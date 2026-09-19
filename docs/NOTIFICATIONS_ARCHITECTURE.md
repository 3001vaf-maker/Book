# Book — Notifications architecture

## 1. Owner

`Notifications` is the single owner of notification business events and delivery state.

Push, Email, Telegram and the client-account feed are delivery channels. They do not own separate copies of notification business logic.

```text
Business event
      ↓
Notifications
  ├─ notification
  ├─ relation to source entity
  └─ deliveries
       ├─ IN_APP
       ├─ PUSH
       ├─ EMAIL
       └─ TELEGRAM
              ↓
        channel adapters
```

## 2. Client-card scope

A notification belongs to a client card, not to an email credential. The client card is resolved by the canonical normalized phone number. Several access credentials for the same phone see the same in-account feed and the same read state.

`UEI` may be attached when an event concerns a concrete person inside the card, but it does not replace the card scope.

## 3. Notification and delivery are different facts

A notification describes what happened: type, title/body, source entity and creation time.

A delivery describes how that notification is exposed through one channel. The same notification can therefore have separate delivery rows for `IN_APP`, `PUSH`, `EMAIL` and `TELEGRAM`.

Minimum delivery states:
- `created`;
- `sent`;
- `delivered`;
- `read`;
- `failed`.

Delivery timestamps are independent: created, sent, delivered, read and failed.

## 4. In-account feed

The internal client-account feed is the first implemented channel.

Opening the notifications list does **not** mark anything as read. `read` is recorded only when the client opens one concrete notification. The read timestamp is card-level, so another session for the same client card sees the same state.

## 5. Relation to business objects

Each notification may reference its source business object with `entityType` + `entityId`. Examples: booking request, business record, payment, debt or master message.

This relation allows a later UI action to open the relevant record without putting booking/finance logic inside Notifications.

## 6. Consent boundary

The internal authenticated account feed is not an outbound mailing channel.

Before outbound delivery, Notifications must evaluate the persisted message `purpose`. `SYSTEM`, `SERVICE` and `DIRECT` are not governed by the advertising consent. `MARKETING` must ask Documents for the current advertising permission at send time. It must not trust a cached flag in Clients, BookingAccount or a delivery record.

Canonical dependency:

```text
Notifications[MARKETING] → Documents.canSendMarketing(...)
```

If the permission is absent or revoked, the outbound delivery is not sent.

## 7. Persistence

Notifications and delivery attempts are server-owned business data. Browser/local storage is never the source of truth.

The persistence model is append-oriented for the notification itself. Channel delivery state may advance through its lifecycle, while timestamps preserve the audit trail.

## 8. Integration boundaries

`Online Booking`, `Finance`, `Records` and future modules may create notifications through the Notifications service. They must not implement their own feed or delivery journal.

Client UI only reads the Notifications projection and sends an explicit `mark read` command for a concrete notification.

One domain owner: **Notifications**.
