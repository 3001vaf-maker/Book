# Internal chat message contract

- `BusinessPerson` is the master's client profile. Its `key` is the stable internal owner of an `IN_APP` conversation.
- A `BookingAccount` is a login/access account. It may be attached to a client profile, but it never owns the conversation.
- First client access is reconciled by normalized phone only: if the phone already exists in the master's client base, the new BookingAccount is attached to that existing client profile; otherwise a new client profile is created.
- Email and Telegram are never identity/deduplication keys for choosing or merging a client profile. They are contact data only.
- Before explicit master linkage, different client profiles have different chats even if some other data looks similar.
- UEI is the master's explicit identity/history mechanism. When the master links duplicate profiles that represent the same person, contacts and data remain historically attributable to their source profile while the current UI aggregates those member profile keys into one canonical profile thread. Existing messages are not rewritten.
- A dependent (for example daughter or son) may have a separate `BusinessPerson`, name, gender, history and separate UEI while having no personal phone/account. This does not make a new reachable `IN_APP` destination. Communication continues through the contact-holder profile/account (for example the mother) until the dependent receives their own access/contact and is explicitly detached/routed accordingly.
- A profile is directly reachable by `IN_APP` only when it has at least one linked BookingAccount. A profile-only dependent with no linked account is not a direct message destination.
- Every inbound `IN_APP` message keeps its actual author snapshot: BookingAccount id, source person key, name and UEI at the time of sending. This preserves who actually wrote even when profiles are later linked or detached.
- Push is not Telegram, email or a Contact Point. Push is only delivery notification transport for an internal message. Business routing is: client profile -> all currently linked BookingAccounts -> their registered device Push endpoints.
- A physical Push subscription belongs to the authenticated device/account that registered it; this is transport ownership only and does not make the BookingAccount the conversation owner.
- Telegram and email are separate external Contact Points. They may later project messages into the same client-profile conversation, but outbound external delivery selects a concrete Contact Point and applies that channel's consent rules separately.
- Rich text is stored as a server-normalized structured document. Arbitrary HTML is never persisted or rendered.
- Supported blocks: paragraph, heading, subheading, quote, list item.
- Supported inline marks: bold, italic, underline, strike, code. Emoji are ordinary Unicode text.
- A sender may edit only their own non-deleted `IN_APP` message. `editedAt` marks the correction.
- A sender may delete only their own `IN_APP` message. Deletion clears body, rich content and attachments, keeps a tombstone row, and sets `deletedAt`.
- Master replies through the internal chat do not depend on Telegram or email configuration; they require only a reachable client profile with a linked BookingAccount.
