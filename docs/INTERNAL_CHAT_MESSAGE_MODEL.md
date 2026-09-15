# Internal chat message contract

- `IN_APP` is the primary two-way channel between the master Book and the registered client account.
- Every new internal message is anchored to `BookingAccount.id`; phone and UEI are display/search aliases only.
- Push is a delivery signal for an internal message, not the conversation identity and not a separate message body.
- Telegram and email are separate external channels and are not required for internal chat.
- Rich text is stored as a server-normalized structured document. Arbitrary HTML is never persisted or rendered.
- Supported blocks: paragraph, heading, subheading, quote, list item.
- Supported inline marks: bold, italic, underline, strike, code. Emoji are ordinary Unicode text.
- A sender may edit only their own non-deleted `IN_APP` message. `editedAt` marks the correction.
- A sender may delete only their own `IN_APP` message. Deletion clears body, rich content and attachments, keeps a tombstone row, and sets `deletedAt`.
- Master replies must work without Telegram or email configuration. When an `IN_APP` account exists, routing must choose it before any external channel.
