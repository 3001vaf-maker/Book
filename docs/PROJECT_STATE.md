# Book — Project State

This file is the authoritative continuity anchor for Book. Read it before architecture or product changes. Current `main` and current regression checks override older repository notes.

## Product essence

Book is a modular SaaS / anti-CRM for beauty professionals, starting with an independent master and expanding later to studios, salons and chains.

Architecture rule:

Core
→ functional module controller
→ data/state owner
→ shared UI
→ manifestation

One entity / one UI / one implementation. No local workaround when a rule belongs in Core/shared UI. UI/CSS may display state but must never become the owner of business logic.

## Production and infrastructure

`main` is production and contains real user data. Never clear, reset or silently replace production facts.

Frontend: GitHub Pages.
Backend: NestJS + PostgreSQL + Prisma on Amvera.
Authentication and tenant identity are server-backed.

Profile + Workplaces have already completed their server-owner migration. Other launch-critical domains still contain browser-local transitional ownership and must be migrated safely later. Browser storage is migration debt, not the target architecture.

Final rule: server + database own business/application data; browser is only the interface and may hold temporary cache. Same account + same tenant must show the same data on Safari, Yandex Browser, iPhone or another computer.

## Production data migration rule

For every remaining domain migration:
1. Preserve existing production browser facts.
2. Add tenant-scoped PostgreSQL/API ownership.
3. Import legacy facts without deleting the legacy copy during verification.
4. Verify counts, IDs, links and critical fields exactly.
5. Switch canonical ownership only after verification.
6. Verify same-account cross-device data.
7. Remove ongoing browser ownership only after the server owner is proven.

Remaining broad dependency order:
Procedures → Documents + Consents → Wallets + DDS movements → Timetable → Clients → Records / Breaks / Journal → Online Booking facts.

Do not resume this migration while a domain's business rules are still unstable.

## Canonical finance architecture — current

Detailed contract: `docs/FINANCE_ARCHITECTURE.md`.

There is deliberately no financial owner called Payment and no payment-editing/correction model. `core/payment.js` has been removed.

### Service / Procedure / Product

Owns the source price fact. This is not a financial instrument.

For a range price such as 7,000–10,000, the minimum 7,000 initially flows into a new Record. The master may then set the real procedure price for that appointment, for example 8,000.

### Record

Record owns the appointment and stores the complete financial snapshot for that appointment. Record does not calculate finance and does not move money.

The stored chain must preserve:
- source item;
- source/master-set price;
- applied discount mode;
- discount percent;
- discount rubles;
- plan / amount due;
- hydrated actual fact totals for history/export.

Record is a recorder/transmitter of these facts.

### Business Model

`core/business-model.js` owns plan/fact calculation.

Plan rule:

`price - applied discount = planTotal / amount due`.

The client's profile discount is the default discount source for a new Record. If the master changes the discount at payment stage, Business Model recalculates the specific Record first. That corrected Record snapshot is saved before DDS receives the payment movement. A payment-stage correction does not automatically change the client's permanent profile discount.

Business Model also derives actual fact from DDS and is the route used by Client / Procedure / Product analytics.

### DDS — Движение денежных средств

`core/dds.js` is the sole owner of actual money movements.

Current movements:
- income: payment;
- expense: refund.

Later DDS expands with purchases, material spending and other income/expense movement types. DDS does not own plan calculations.

Each movement preserves enough source/business context for historical attribution. Existing legacy `book.payments` facts are read non-destructively and migrated into the DDS representation; they are not cleared.

### Wallet

Wallet owns its own metadata/settings and final cash/balance. Its history and balance are a projection of DDS movements for that wallet.

Money path is never `Record → Wallet`.

Canonical path:

`Record/payment action → DDS → Wallet`.

### Client / Procedure / Product financial facts

Client must show how much that client actually brought.
Procedure/Product must show how much that item actually brought.

These manifestations do not calculate DDS independently. They read Business Model fact, which derives actuals from DDS. Refunds reduce the corresponding actual fact.

Products already have the same metric route, but actual product-sale movements are not yet implemented, so the value remains zero until such DDS movements exist.

## Canonical pricing example

Price set by master: 8,000 ₽.
Applied client discount: 20%.
Discount amount: 1,600 ₽.
Plan / amount due: 6,400 ₽.

Record stores the full chain: `8,000 / 20% / 1,600 / 6,400`.

Journal card/day total use 6,400, not 8,000.
Payment opens with 6,400.
DDS records +6,400 only when the money is actually paid.
Wallet receives +6,400 from DDS.
Client and Procedure actual contribution become 6,400 through Business Model fact.

If the profile discount was 0 and the master applies 20% only during payment, Business Model recalculates the same chain and updates Record first; only then DDS records +6,400.

## Payment and refund rules

Only two historical financial actions exist: Payment and Refund.

Wrong payment:
`refund → new payment`.

There is no Edit Payment / Correct Payment historical mutation. Payment/refund facts are immutable.

Split payment is a normal payment mode with multiple wallet allocations. A full refund makes the Record payable/editable again; a partial refund leaves the remaining active payment balance.

The payment UI is input/display only. It may let the master enter a percent or ruble discount, but calculation belongs to Business Model and actual movement belongs to DDS.

## Journal financial rule

Journal does not invent financial arithmetic.

Record card, Journal list and day header use Business Model `planTotal` — the amount after the applied client/payment-stage discount.

Example: service 5,000 with 20% discount → Journal/day amount is 4,000, not 5,000.

Paid/unpaid visual state comes from DDS actual payment state, not from plan calculation.

## Current daily-work contour

Production-visible structure:
- Main → Clients → Client Profile
- Timetable → Calendar
- Journal → Day / Month / List
- Settings → Profile / Service / Documents / Wallet / Tags

Hidden or parked until ready:
- Chat
- Warehouse
- Loyalty expansion
- broader reports/marketing/notifications surfaces

Do not delete parked modules merely because they are not currently shown.

## Documents / agreements

Documents is a general product document domain, not only consents.

Current structure includes Templates and History. Consent/signing facts must remain canonical and linked to client + document/version. Client Profile is only another manifestation of the same consent fact.

## Online booking — later launch block

Do not start broad online-booking work until the current daily-work contour and required server ownership are reliable.

Minimum future flow remains:
introduction → agreements → client identity → workplace → procedures → date → free slot → confirmation.

Server must prevent double booking transactionally.

## Warehouse — later

Warehouse remains a major future autonomous module. It will later provide purchases, material consumption, inventory, recipes, expiry, equipment/amortization and other expense inputs that feed the DDS expense side where appropriate.

Do not pull Warehouse scope into current payment/finance visual cleanup.

## UX / architecture constraints

- One shared modal system.
- One shared selector mechanism.
- One shared date/time system; duration uses shared duration UI.
- Shared Core/UI/CSS rather than local duplicates.
- Do not repair owner/render/state mistakes with CSS.
- Do not rename sections without explicit product reason.
- Do not delete implemented entities or production facts.
- Client identity uses existing UEI/name/phone rules.
- Controllers should converge on one coherent render lifecycle rather than stacked local renders.

## Current validation rule

For every production release block:
1. Start from current `main`.
2. Work on a feature branch for a coherent block.
3. Run Check Book on exact feature HEAD.
4. Merge only after success.
5. Verify exact merged `main` with Check Book and GitHub Pages.
6. If backend files changed, also verify the deployed backend/API before calling the block complete.

## Latest finance foundation release

PR #26 `Establish DDS and business finance ownership` established the canonical finance separation:
- Business Model for plan/fact;
- DDS for actual movements;
- Wallet for wallet cash/history projection;
- Record for the stored appointment financial snapshot;
- Client / Procedure / Product actual contribution paths;
- payment-stage discount persistence;
- removal of obsolete `core/payment.js`;
- architecture regression guard preventing those responsibilities from being mixed again.

No server/backend migration was included in this finance-foundation release.

## Immediate next product work

Return to payment/Record visual behavior only after this financial foundation is stable. Visual work must consume the established owners rather than recreate financial formulas locally.
