# Message purpose

Client-facing messages in a Book are classified by **purpose**, independently of delivery channel.

- `SYSTEM` — account, security, technical access/linking.
- `SERVICE` — operational messages about booking/service execution.
- `DIRECT` — person-to-person chat between the business and the client.
- `MARKETING` — advertising, promotions, free slots and broadcasts.

`purpose` is not a delivery status and not a channel.

Examples:
- Telegram can carry SYSTEM, SERVICE, DIRECT or MARKETING.
- Email can carry SYSTEM, SERVICE, DIRECT or MARKETING.
- Push can carry SYSTEM, SERVICE, DIRECT or MARKETING.

Permission rules are intentionally not changed in this step. The purpose must first be explicit and persisted at the message source. Existing legacy rows that cannot be classified safely remain with null purpose until a later migration/reconciliation.
