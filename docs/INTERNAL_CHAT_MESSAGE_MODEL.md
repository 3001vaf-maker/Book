# Internal chat message contract

- `IN_APP` is the primary two-way channel between the master Book and a client profile.
- The conversation owner is the current client profile (`BusinessPerson.key`), never phone, email, Telegram, Push endpoint or `BookingAccount.id`.
- Before master linkage, different client profiles/accounts have different chats. After explicit UEI linkage, current member profile keys are aggregated into one canonical profile thread without rewriting history.
- Every inbound message keeps its source profile key plus an author snapshot: account id, person key, name and UEI. This identifies who actually wrote inside a shared profile chat.
- `BookingAccount` is a login/account and message-author anchor. It does not own the conversation.
- Push is a delivery signal for an internal message. Business routing is profile → linked accounts → registered device Push endpoints. Push is not a Contact Point and not a separate chat channel.
- Telegram and email are separate external Contact Points. They may project into the same profile chat, but outbound external delivery selects a concrete Contact Point and checks its consent separately.
- Rich text is stored as a server-normalized structured document. Arbitrary HTML is never persisted or rendered.
- Supported blocks: paragraph, heading, subheading, quote, list item.
- Supported inline marks: bold, italic, underline, strike, code. Emoji are ordinary Unicode text.
- A sender may edit only their own non-deleted `IN_APP` message. `editedAt` marks the correction.
- A sender may delete only their own `IN_APP` message. Deletion clears body, rich content and attachments, keeps a tombstone row, and sets `deletedAt`.
- Master replies must work without Telegram or email configuration whenever the client profile exists.
