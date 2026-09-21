# Book — Finance Architecture

This file is the single canonical source of truth for the Finance ownership rebuild.

## Status

Finance is under an ordered ownership migration. The target architecture below is canonical even while the current runtime still contains legacy names and storage that are explicitly listed in the checklist.

Permanent integration branch: `staging`. The current feature branch for each stage is recorded in `docs/PROJECT_STATE.md`.

Release rule:

`feature/* -> staging -> full verification -> one release to main`

Do not merge an incomplete Finance rebuild to `main`.

## Product placement vs technical ownership

The user-facing Finance folder lives on Main:

```text
Main
├── Clients / People manifestation
├── Finance
└── Analytics        # future product area
```

Current Finance UI lives under `main/finance/`.

The hidden business rules may live under `core/finance/`. This does not mean Finance is a user-facing child of Core; Core is only the technical owner of domain rules.

The future Financial Model may later be manifested inside Finance or inside a future Analytics folder. Its UI placement is intentionally NOT decided now.

## Canonical vocabulary

### Settlement / Расчёт

Settlement answers only the commercial calculation for one source such as a Record:

`source price - applied discount = amount due`

and then, by reading money facts:

`amount due - net paid = outstanding amount`

Settlement may answer:
- source price;
- applied discount;
- amount due / accrued;
- paid amount;
- refunded amount;
- outstanding debt;
- paid / debt / no-payment projection.

Settlement is NOT the Financial Model.

### Ledger / ДДС

Ledger is the canonical fact history of actual money movement.

One Ledger row = one actual movement of money into or out of one wallet.

Ledger owns:
- amount;
- IN / OUT direction;
- factual date/time;
- wallet;
- article;
- economic character;
- source reference when applicable;
- operation reference;
- immutable history/cancellation semantics.

Ledger does not own plans.

### Operation

Operation groups one or more Ledger rows into one economic event.

Example: one service of 8,000 paid as 3,000 cash + 5,000 card is one Operation and two Ledger rows. It is not two services.

### Articles / Статьи

Articles classify movements.

The user may create and subdivide articles to any useful depth. A simple user may keep only `Materials`; another may use `Materials -> Color -> Wella -> Koleston -> 7/1`.

Custom article names never replace the system economic character needed for calculations.

System economic characters must distinguish at least:
- operating revenue;
- operating expense;
- tax;
- tips;
- refund;
- loan received;
- loan repayment;
- investment received;
- investment return;
- transfer.

Money coming in is not automatically revenue. Money going out is not automatically operating expense.

### Wallet / Касса

Wallet owns only wallet identity and settings.

Wallet balance and history are projections of Ledger:

`sum(IN) - sum(OUT)`

Wallet must never own a second independent balance truth.

### Z-report

Z-report stores no independent money facts.

It is a projection of Ledger for one day or another selected period.

### Financial Model / Финансовая модель — RESERVED

Financial Model is a future planning and analysis instrument.

It is NOT used to:
- accept payment;
- calculate one Record amount due;
- create Ledger movements;
- mutate Record;
- own Wallet balance.

It will later own business plans and compare them with facts from multiple domains.

Examples:
- planned revenue vs actual revenue;
- planned clients vs actual clients;
- planned work hours vs actual hours;
- planned material expense vs actual expense;
- planned rent using amount × hour/day/month;
- margins, deviations and cross-factor analysis.

Example:

```text
Friday plan:
revenue 10,000
clients 2

fact:
revenue 12,000
clients 1

analysis:
revenue 120%
client count 50%
average ticket above plan
```

The Financial Model may read facts from Finance/Ledger, Record, People, WorkTime, Products and other canonical owners. It must not become the operational owner of those facts.

Its final UI location — Finance or future Analytics — is intentionally reserved, not decided.

## Ownership

| Area | Canonical owner | Must not own |
|---|---|---|
| Service / Procedure / Product | source identity/current catalog price | money movement/history |
| Record | appointment, Person, time/place, selected source snapshots | payment movement, wallet balance, payment truth |
| Settlement | accrued / due / paid / refunded / outstanding calculation | Ledger persistence, future business planning |
| Ledger / DDS | every factual money movement | plan |
| Operation | grouping of related Ledger rows | duplicate money truth |
| Articles | classification tree + economic character | amounts/balances |
| Wallet | wallet metadata/settings | independent balance |
| Z-report | period projection of Ledger | stored money facts |
| Financial Model | future plans, plan-vs-fact, deviation analysis | operational payment/Record/Ledger ownership |

## Canonical operational flow

```text
Service / Procedure / Product
            ↓ source snapshot
          Record
            ↓ source fact
        Settlement
            ↓ amount due
Payment / Expense / Refund / Loan / Investment / Transfer command
            ↓
         Operation
            ↓
     Ledger / DDS rows
            ↓
   ┌────────┼───────────┐
   ↓        ↓           ↓
Wallet    Z-report   Settlement projection
```

Record only transmits its facts. Record does not accept money.

Payment state is derived:

```text
Record amount due
- net applicable Ledger fact
= outstanding amount
```

## Future Financial Model fact flow

```text
Ledger ───────┐
Record ───────┤
People ───────┤
WorkTime ─────┼──> Financial Model
Products ─────┤
Articles ─────┘
```

The direction back into operational truth is forbidden. Financial Model observes, plans and analyses; it does not rewrite the factual owners.

## Persistence target

The target money persistence is append-oriented server-owned records, not replacement of one entire Finance JSON blob.

A Ledger entry must be independently persisted so simultaneous users/devices cannot overwrite each other's unrelated movements.

Migration must preserve existing valid history until verified replacement exists.

## F1 inventory findings and migration status

This section preserves what F1 found at `staging@522b593d9c5d1a1ea37b152b8f0802389eeb81e8`. Items marked resolved are historical evidence, not current architecture:

1. **RESOLVED IN F2:** legacy `core/finance/model.js` was removed; its operational responsibility now lives in `core/finance/settlement.js`.
2. **RESOLVED IN F2:** old `calculateFinancialPlan` / `getRecordFinancialPlanFact` and related Record-plan APIs were replaced by Settlement terminology.
3. `docs/FINANCE_ARCHITECTURE.md` previously described `Record -> Finance model -> Record snapshot`; that ownership is superseded by this document.
4. Browser and server Finance calculations are not fully semantically aligned.
5. Record persistence can retain/derive financial state that competes with corrected payment-stage calculation.
6. Current Finance facts are stored inside a tenant auxiliary JSON dataset and whole-dataset writes can lose concurrent updates.
7. **RESOLVED IN F2:** the wrong `core/business-model.js` reservation was removed; CI now reserves Financial Model by rejecting operational financial-model modules/imports and the complete old Record-plan API.
8. Payment is currently reachable through Record/Journal manifestation code; the migration must ensure the command owner is Finance, while Record only supplies source facts.

## F1 verified inventory — current ownership before runtime migration

Inventory source: `staging@522b593d9c5d1a1ea37b152b8f0802389eeb81e8`.

F1 changes no runtime behavior. It records what the application actually does today so later steps cannot silently recreate a second owner.

**Historical-name note:** code names shown inside the F1 inventory below (for example `calculateFinancialPlan`, `hydrateRecordFinance`, `FinanceService.calculatePlan`) are the exact names that existed at the F1 checkpoint. F2 subsequently replaces those names with Settlement; do not treat the F1 spellings as current APIs.

### Current physical storage

Current Finance money facts are not a flat Ledger.

`core/finance/data.js` owns an in-memory object:

```text
financeState
├── version
├── income[]
└── expense[]
```

Each payment is one `income[]` object. A split-wallet payment stores nested `allocations[]` inside that one object. Wallet history later expands those allocations into virtual wallet rows.

Each refund is an `expense[]` object linked by `originalPaymentId`.

The whole Finance object is sent through:

```text
core/finance/data.js
→ queueAuxiliaryDataset('finance', wholeFinanceState)
→ PUT /auxiliary-state/finance
→ BusinessAuxiliaryState.data.finance
```

`BusinessAuxiliaryState.data` also contains wallets, tags, products and productHistory. There is no Prisma Ledger/Operation/FinanceMovement row model.

Consequences:
- one unrelated payment write replaces the tenant's whole Finance dataset;
- the browser queue serializes writes only inside one browser runtime, not across devices/users;
- split-wallet facts are nested, not one factual row per wallet movement;
- cancellation mutates existing payment/refund status inside the blob rather than appending a separate immutable server fact.

### Current Record creation/update flow

Browser:

```text
Record create/update
→ core/record/service.js
→ core/finance.calculateFinancialPlan / repriceFinancialPlan
→ record.finance
→ queueRecordUpsert
```

Server:

```text
PUT /business-state/records/:recordId
→ RecordService
→ FinanceService.calculatePlan
→ record.data.finance
→ Prisma Record.data JSON
```

Therefore Record currently owns and persists a Finance plan snapshot even though the target contract says Settlement owns amount-due/payment calculation.

The browser and server also use different calculation implementations:
- browser Finance supports per-item percent/money/none discounts;
- server `FinanceService.calculatePlan()` applies one global percent to all items.

### Confirmed payment-stage ownership conflict

Current payment flow is:

```text
journal/record-payment.js
→ payment UI edits price/discount
→ browser calculateFinancialPlan()
→ saveFinancialCorrection()
→ updateRecord(... procedures/products + finance)
→ Record PUT to server

then

ui/payment/methods.js
→ derives received/applied/Tips from wallet allocations

then

core/finance/service.js::recordPaymentIncome()
→ mutates browser financeState
→ whole Finance JSON PUT to auxiliary-state

then

setRecordAttendance(... 'arrived')
→ another Record PUT
```

This is not one atomic payment command. One user action can cause separate Record and Finance writes.

Two concrete server conflicts are confirmed:

1. **Discount-only correction can be discarded.**  
   `RecordService.upsertFromOwner()` ignores incoming explicit `record.finance` when procedures/products/person did not change and keeps `current.finance`.

2. **Procedure price correction can be canonicalized back to catalog price.**  
   When procedures changed, server RecordService calls `ProcedureService.snapshots()`. That service reads the current catalog cost; RecordService preserves requested duration but not requested corrected cost, then recalculates `finance`.

This directly contradicts the current guard that calls payment the single editable price-correction point.

### Current read/projection flow

Browser Record reads are also financially hydrated:

```text
core/record/read.js
→ hydrateRecordFinance()
→ resolve Record stored finance
→ read DDS movements for recordId
→ return Record with hydrated finance fact
```

So the runtime Record object currently carries both appointment facts and a Finance projection.

Finance is also read directly by:
- Journal Day/Month/List for paid state and displayed amount;
- People metadata for paid total;
- Procedure/Product cards for realized financial fact;
- Wallet for balance/history;
- Main/Finance for DDS and cash;
- payment UI for payment/refund/cancel state.

These read consumers are not necessarily ownership defects. They must consume the future canonical Finance/Settlement/Ledger read contract instead of inventing local calculations.

### Current server Finance role

`server/src/finance/` has a service/module but no payment command controller.

Its current responsibilities are only:
- duplicate `calculatePlan()`;
- read `BusinessAuxiliaryState.data.finance`;
- calculate Record payment state for server Record projections.

Actual payment/refund/cancel commands are currently executed in browser `core/finance/service.js`, then the resulting whole JSON is uploaded.

Target ownership requires the server to become authoritative for factual money writes.

### Current ownership map

| Concern | Current owner(s) | Target owner | Migration |
|---|---|---|---|
| Catalog procedure/product price | Procedure/Product | Procedure/Product | keep |
| Record selected service/product snapshot | Record | Record | keep |
| Default Person discount source | Person + copied Record/Finance data | Person fact read by Settlement | F2/F3 |
| Amount due calculation | browser Finance rules/model + browser Record service + server FinanceService + server RecordService | Settlement | F2/F3 |
| Per-item discount calculation | browser Finance rules | Settlement | F2 |
| Server discount calculation | server FinanceService, different algorithm | same Settlement semantics | F2/F11 |
| Stored `record.finance` plan | Record browser + Record server | not independent payment truth; Settlement projection/snapshot compatibility only during migration | F3 |
| Hydrated payment fact inside runtime Record | Record read calls Finance | Settlement read projection consumed by Record UI | F3 |
| Paid/partial/remaining calculation | browser Finance model/rules + server FinanceService | Settlement | F2/F3/F11 |
| `due / debt / paid` label | `core/record/state.js` combines Record visit + payment due | Settlement monetary state; cross-domain display may read Record lifecycle without Record owning money | F3 |
| Payment command | browser `core/finance/service.js` | Finance command → server Operation/Ledger transaction | F4/F11 |
| Refund command | browser `core/finance/service.js` | Finance command → server Operation/Ledger transaction | F4/F11 |
| Incorrect payment cancellation | browser mutation of income/refund statuses | auditable Finance/Operation/Ledger cancellation semantics | F4/F11 |
| Money persistence | whole `finance` JSON in BusinessAuxiliaryState | independent append-oriented Ledger rows | F4/F11 |
| IN/OUT representation | separate `income[]` / `expense[]` arrays | flat Ledger direction + economic character | F4 |
| Split-wallet payment | one payment with nested `allocations[]` | one Operation + multiple Ledger rows | F5 |
| Operation identity | payment id; refund links originalPaymentId | explicit Operation owner | F5 |
| Articles | absent | user-extensible Articles hierarchy + system economic character | F6 |
| Wallet metadata | `settings/wallets/data.js` + auxiliary JSON | Wallet | keep/F7 |
| Wallet balance/history | projection of DDS | projection of Ledger | keep concept/F7 |
| Manual income/expense | absent | Income/Expense command surface | F8 |
| Loan/investment/returns/transfers | absent | explicit economic types/commands | F9 |
| Z-report | absent; current UI only lists/exports DDS | Ledger report projection | F10 |
| Payment allocation/Tips preview | UI derives applied amount and Tips | UI may preview; Finance/Settlement server validates/derives authority | F11 |
| Person paid total | People metadata reads Finance | projection from Ledger/Settlement | adapt after F4 |
| Procedure/Product realized revenue | cards read Finance allocation | projection from Ledger/Operation facts | adapt after F4/F5 |
| Account finance display | Account shell re-parses server Record finance/payment DTO | consume canonical Settlement projection | F3/F11 |
| Future Financial Model | name currently occupied by `core/finance/model.js`; real tool absent | RESERVED analytical layer | F2 reservation only |

### Existing concepts that are already directionally correct

Do not destroy these merely because storage/terminology changes:

- Finance has one public browser contract: `core/finance/index.js`.
- Record does not directly write Wallet.
- Wallet balance is derived from money facts rather than stored as a second balance.
- payment/refund/cancel are distinguished conceptually;
- cancelled operations are excluded from active balance/payment projections;
- Tips are separated from service revenue;
- partial payments are supported;
- one payment can currently be distributed across multiple wallets;
- People, Procedure and Product financial metrics are projections rather than independent stores.

### Gaps relative to the target model

The current implementation has no canonical:
- flat Ledger row;
- explicit Operation aggregate;
- Article tree;
- economic character independent of IN/OUT;
- generic manual income/expense command;
- loan/investment/repayment/return/transfer commands;
- Z-report projection;
- server payment/refund/cancel endpoint;
- database transaction covering payment and Ledger rows;
- concurrency-safe independent money-row persistence;
- actual future Financial Model.

Money timestamps are also heterogeneous (`paidAt`, `refundedAt`, `createdAt`, plus legacy date/time fields). F4 must define one factual Ledger occurrence time while preserving original audit timestamps as needed.

### Guards/docs/tests that currently protect legacy ownership

These files must be migrated deliberately; a green check today does NOT mean the target Finance ownership already exists.

| File | Legacy rule currently encoded | Target stage |
|---|---|---|
| `docs/DOMAIN_ARCHITECTURE_STANDARD.md` | calls Finance a “financial plan model” | F2 |
| `docs/PROJECT_STATE.md` completed Record block | historical wording says Finance owns price-plan/payment state | F2/F3 clarification |
| `scripts/check-finance-architecture.mjs` | says Financial Model owns plan/fact; reserves wrong `core/business-model.js`; requires current whole Finance state; requires correction persisted into Record | F2–F4 |
| `scripts/check-record-ownership.mjs` | requires Record read to `hydrateRecordFinance`; requires server RecordService to call `finance.calculatePlan` | F2/F3 |
| `scripts/check-booking-server-autonomy.mjs` | requires RecordService → FinanceService.calculatePlan and old server payment-state implementation | F2/F3/F11 |
| `scripts/check-auxiliary-server-ownership.mjs` | requires Finance whole-dataset auxiliary persistence | F4/F11 |
| `tests/critical-record-flow.test.mjs` | asserts `record.finance` as plan/fact owner and payment-stage finance written to Record | F2/F3 |
| `tests/record-products.test.mjs` | asserts product discount plan persisted in Record finance | F2/F3 |
| `tests/record-state.test.mjs` | Record State owns due/debt/paid projection | F3 |
| `tests/booking-server-autonomy.test.mjs` | asserts duplicate server plan calculator and `unpaid/partial/paid` service | F2/F3/F11 |
| `tests/payment-ui.test.mjs` | explicitly requires UI formula `tips = received - applied` | F11 |
| `tests/payment-refund.test.mjs` | protects useful behavior but against old income/expense blob shape | F4/F5 migration |
| `tests/payment-cancel.test.mjs` | protects useful cancel/refund semantics but against mutable blob storage | F4/F5 migration |
| `tests/wallets.test.mjs` | protects useful derived balance but against nested payment allocation shape | F4/F5/F7 |
| `tests/person-metadata.test.mjs` | reads paid totals through old Finance movement shape | F4 adaptation |
| `server/prisma/seed-staging.ts` | seeds `record.finance` and `BusinessAuxiliaryState.finance.income/expense` old shape | F3/F4/F5 |

### F1 migration constraints

The inventory fixes these constraints for later steps:

1. F2 is a terminology/responsibility migration first. It must not invent the future Financial Model.
2. F3 must break Record payment ownership without deleting Record's legitimate appointment/source snapshots.
3. A payment-stage corrected source price may update the Record source snapshot when that is the final factual service/product price, but discount/due/paid/debt must not become Record-owned truth.
4. The current payment action must stop depending on multiple competing plan calculators.
5. F4/F5 must preserve valid payment/refund/cancel history while converting nested Finance data to Ledger/Operation semantics.
6. UI may calculate previews for responsiveness, but server Finance must validate and own the authoritative result.
7. The final architecture must not have browser and server implementations that can produce different Settlement results from the same facts.
8. Existing tests that protect correct business behavior should be rewritten around the new owners, not deleted merely because their old storage/terminology changes.
9. No F1 runtime change is permitted. F1 only establishes the verified migration map.

## F2 implementation checkpoint — Settlement terminology

F2 changes terminology and responsibility names only. It intentionally does not change the persisted money shape or the Record ownership problem scheduled for F3/F4.

Implemented in the F2 branch:

- `core/finance/model.js` removed;
- `core/finance/settlement.js` is the operational amount-due / paid / refunded / outstanding projection owner;
- browser public contract uses `calculateSettlement`, `repriceSettlement`, `resolveRecordSettlement`, `getRecordSettlement`, `hydrateRecordSettlement`, `recordAmountDue` and Settlement aggregate names;
- server `FinanceService` uses `calculateSettlement()` and `recordSettlementPaymentState()`;
- Record/Journal/People/Procedure/Product consumers use Settlement names through `core/finance/index.js`;
- Payment UI emits a `settlement` preview to the Finance command;
- `recordPaymentIncome()` accepts `settlement` as its operational input;
- regression tests retain the same payment/discount/partial/Tips/refund/cancel behavior under Settlement names;
- the incorrect future `business-model.js` reservation is removed;
- finance architecture guards reject the old Record-plan API and forbid operational Financial Model modules/imports.

Compatibility intentionally retained for later stages:

- `record.finance` and payment movement `finance` snapshot fields;
- persisted `planAmount`, `planTotal`, `factIncome`, `factExpense`, `factTotal`;
- current `BusinessAuxiliaryState.data.finance` storage;
- current Record ownership of the stored snapshot.

Those names are persistence compatibility only. They are not the future Financial Model. Removing their ownership/storage role belongs to F3-F5/F11.

## Ordered rebuild checklist

One step must be completed, tested and checked before the next step is marked complete.

### F0 — Freeze the contract and continuity anchor
- [x] Replace the old Finance architecture document with this canonical ownership model.
- [x] Reserve “Financial Model” exclusively for the future plan/fact analytical instrument.
- [x] Define Settlement as the owner of amount-due / paid / debt calculation.
- [x] Record the product placement: Finance is a Main folder; Core is only the hidden technical owner.
- [x] Keep future Financial Model UI placement undecided between Finance and future Analytics.
- [x] Record the full ordered F0-F12 migration chain.
- [x] F0 exact-head Check Book #1967 passed; after merge to staging, Check Book #1968 also passed all three jobs.

### F1 — Inventory all current Finance ownership
- [x] Map every Finance/Record/Wallet/payment/server/UI persistence and formula path.
- [x] Identify duplicate calculations and duplicate state owners.
- [x] Identify all docs/guards/tests that encode the old Financial Model meaning.
- [x] Produce explicit current-owner -> target-owner mapping before runtime changes.
- [x] F1 inventory/diff verified on Check Book #1969; final documentation-close head must also pass before merge to staging.

### F2 — Rename old “Financial Model” responsibility to Settlement
- [x] Rename internal responsibility without changing money behavior first.
- [x] Remove “Financial Model” terminology from Record settlement APIs/comments/docs/guards.
- [x] Remove the incorrect future `business-model` reservation.
- [x] Add guard protection so “Financial Model” cannot again become payment/Record logic.
- [x] Migrate all repository callers to the Settlement public contract and remove the old `model.js` atom instead of keeping a permanent compatibility wrapper.
- [x] F2 behavior/diff verification passed on Check Book #1974; this documentation-close head must also pass exact-head Check Book before merge to staging.

### F3 — Remove payment ownership from Record
- [x] Record remains owner of appointment and source snapshots only; Settlement/payment truth lives in Finance.
- [x] Record does not create money movements.
- [x] Record does not persist payment truth as an independent source.
- [x] Journal/payment UI only starts Finance commands and displays Finance projections.
- [x] Paid/debt state is derived by Settlement from amount due + Ledger facts.

### F4 — Canonical Ledger / DDS
- [x] Define one flat Ledger-entry contract.
- [x] Every factual ruble IN/OUT has a timestamp, wallet, amount and economic classification.
- [x] Preserve immutable/cancel/refund audit history through separate operations/reversal rows.
- [x] Migrate away from whole-Finance-JSON last-write ownership; legacy auxiliary Finance is migration-only.

### F5 — Operation grouping
- [x] Introduce Operation identity.
- [x] One operation may create multiple Ledger rows.
- [x] Split-wallet payment remains one economic payment.
- [x] Detailed multi-line payment facts remain grouped by one Operation instead of becoming unrelated expenses.
- [x] F3-F5 merged to `staging@b3819f4033424cec502244b667781e004d5796a0`; Check Book #1989 and post-merge Check Book #1990 passed all required jobs.

### F6 — Articles
- [x] Introduce user-extensible hierarchical article catalog.
- [x] Allow arbitrary useful detail depth with cycle protection.
- [x] Keep system economic character separate from custom article name.
- [x] Cover operating revenue/expense, tax, tips, refund, loan, investment and transfer semantics.

### F7 — Wallet / Cash projection
- [x] Wallet stores metadata/settings only.
- [x] Balance = Ledger projection.
- [x] Wallet history = Ledger projection.
- [x] No independent wallet balance truth remains.

### F8 — Income / Expense instrument
- [x] Add direct manual income/expense command surface.
- [x] Simple amount entry supported.
- [x] Detailed quantity × unit price lines supported.
- [x] Results are one Operation + one or many Ledger rows, not a parallel store.
- [x] F6-F8 merged to `staging@18af1dee4f127e00f720dfd522835b5e2c3e0258` via PR #245; feature Check Book #1993 and post-merge Check Book #1994 passed all required jobs.

### F9 — Loans / Investments / Returns / Transfers
- [x] Loan received is cash IN but not operating revenue.
- [x] Loan repayment is cash OUT but not ordinary operating expense.
- [x] Investment received/returned are distinct economic types.
- [x] Wallet-to-wallet transfer is one Operation with OUT + IN Ledger rows and does not become business revenue/expense.

### F10 — Z-report
- [x] Build day report from Ledger only.
- [x] Support arbitrary period with the same projection engine.
- [x] Show article/economic/wallet breakdowns without creating report-owned facts.
- [x] Z-report uses factual `occurredAt`, so late entry/late Record closure does not move revenue to the Book recording date.

### F11 — Browser/server/storage alignment
- [x] One semantic Finance contract across browser and server, including cent-level money rounding.
- [x] Server transaction is authoritative for money writes.
- [x] Append persistence is concurrency-safe through Serializable transactions with retry on serialization conflict.
- [x] Roundtrip tests cover discounts, corrections, partial payments, split wallets, tips, refund and cancel.
- [x] Reload cannot prefer stale Record.finance over canonical FinanceSettlement or create phantom debt.
- [x] Every factual Finance operation has immutable `occurredAt` (real-world occurrence) and separate system `recordedAt` (when written to Book).

### F12 — Guards, full regression, staging, release
- [x] Guards reject a second payment owner, DDS owner, wallet balance owner or Record-owned money truth.
- [x] Guards reserve Financial Model meaning and prevent operational imports/mutations.
- [x] Full Check Book green on feature head: #1996.
- [x] Post-merge staging Check Book green: #1997, including migration, backend, four production domains and staging frontend.
- [x] PROJECT_STATE updated with final verified Finance ownership.
- [ ] Final whole-staging release Check Book on the exact Finance closeout head.
- [ ] Only after that check and a green `staging -> main` PR may this release merge to `main`.

## Financial Model reservation rule

Until a dedicated future project explicitly begins the Financial Model:

- do not create its implementation opportunistically;
- do not use its name for Settlement;
- do not use its plan/fact terminology for a single Record payment;
- do not make it a dependency of operational payment or Ledger commands;
- do not decide its UI placement merely because Finance is being rebuilt.

This reservation exists specifically so future Financial Model work can be added as a new analytical layer without rewriting the operational Finance core.

## Transaction time rule

Every factual financial Operation has two separate timestamps:

- `occurredAt` = when the money movement actually happened in the real world. This is mandatory and may be entered for a past date.
- `recordedAt` = when the Operation was written into Book. This is system-owned audit time and is not user-editable.

Reports, Z-report, daily income and period analytics use `occurredAt`, never the Record closing time and never `recordedAt`.

For a Record payment opened later, the payment form defaults `occurredAt` to the Record date and end time; the master may change it if actual payment occurred at another moment.

## Workplace rent ownership rule

Rent conditions are not Finance-owned configuration.

- Workplace owns the rent agreement/condition facts: amount and cadence/unit such as hour, day, month or another future workplace-specific rule.
- Finance/Ledger owns only factual rent money movements once they occur, normally classified under the rent expense article.
- Future Financial Model may read Workplace rent conditions to build planned cost and compare plan vs fact.
- Record does not own rent conditions and Finance must not duplicate them as settings.

Target flow:

`Workplace rent condition -> future Financial Model plan -> factual rent payment -> Finance Operation/Ledger -> Z/reporting`.

