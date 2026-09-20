# Book — Finance Architecture

This file is the single canonical source of truth for the Finance ownership rebuild.

## Status

Finance is under an ordered ownership migration. The target architecture below is canonical even while the current runtime still contains legacy names and storage that are explicitly listed in the checklist.

Current migration branch: `feature/finance-ownership-rebuild-20260920`.

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

## Known current legacy / defects

These are not canonical architecture; they are migration debt:

1. `core/finance/model.js` is named and documented as “Financial Model”, although its actual responsibility is closer to Settlement.
2. Functions such as `calculateFinancialPlan` and `getRecordFinancialPlanFact` use “plan/fact” vocabulary for Record settlement, colliding with the reserved future Financial Model.
3. `docs/FINANCE_ARCHITECTURE.md` previously described `Record -> Finance model -> Record snapshot`; that ownership is superseded by this document.
4. Browser and server Finance calculations are not fully semantically aligned.
5. Record persistence can retain/derive financial state that competes with corrected payment-stage calculation.
6. Current Finance facts are stored inside a tenant auxiliary JSON dataset and whole-dataset writes can lose concurrent updates.
7. Current Finance architecture guard still contains legacy terminology and a wrong reservation for `core/business-model.js`.
8. Payment is currently reachable through Record/Journal manifestation code; the migration must ensure the command owner is Finance, while Record only supplies source facts.

## Ordered rebuild checklist

One step must be completed, tested and checked before the next step is marked complete.

### F0 — Freeze the contract and continuity anchor
- [x] Replace the old Finance architecture document with this canonical ownership model.
- [x] Reserve “Financial Model” exclusively for the future plan/fact analytical instrument.
- [x] Define Settlement as the owner of amount-due / paid / debt calculation.
- [x] Record the product placement: Finance is a Main folder; Core is only the hidden technical owner.
- [x] Keep future Financial Model UI placement undecided between Finance and future Analytics.
- [x] Record the full ordered F0-F12 migration chain.
- [ ] Final F0 Check Book / diff review / PR-to-staging verification.

### F1 — Inventory all current Finance ownership
- [ ] Map every Finance/Record/Wallet/payment/server/UI persistence and formula path.
- [ ] Identify duplicate calculations and duplicate state owners.
- [ ] Identify all docs/guards/tests that encode the old Financial Model meaning.
- [ ] Produce explicit current-owner -> target-owner mapping before runtime changes.

### F2 — Rename old “Financial Model” responsibility to Settlement
- [ ] Rename internal responsibility without changing money behavior first.
- [ ] Remove “Financial Model” terminology from Record settlement APIs/comments/docs/guards.
- [ ] Remove the incorrect future `business-model` reservation.
- [ ] Add guard protection so “Financial Model” cannot again become payment/Record logic.
- [ ] Preserve public compatibility only as long as needed for safe migration, then remove it.

### F3 — Remove payment ownership from Record
- [ ] Record remains owner of appointment and immutable source snapshots only.
- [ ] Record does not create money movements.
- [ ] Record does not persist payment truth as an independent source.
- [ ] Journal/payment UI only starts Finance commands and displays Finance projections.
- [ ] Paid/debt state is derived by Settlement from amount due + Ledger facts.

### F4 — Canonical Ledger / DDS
- [ ] Define one flat Ledger-entry contract.
- [ ] Every factual ruble IN/OUT has a timestamp, wallet, amount and economic classification.
- [ ] Preserve immutable/cancel/refund audit history.
- [ ] Migrate away from whole-Finance-JSON last-write ownership.

### F5 — Operation grouping
- [ ] Introduce Operation identity.
- [ ] One operation may create multiple Ledger rows.
- [ ] Split-wallet payment remains one economic payment.
- [ ] Detailed purchase may contain many lines without becoming unrelated expenses.

### F6 — Articles
- [ ] Introduce user-extensible hierarchical article catalog.
- [ ] Allow arbitrary useful detail depth.
- [ ] Keep system economic character separate from custom article name.
- [ ] Cover operating revenue/expense, tax, tips, refund, loan, investment and transfer semantics.

### F7 — Wallet / Cash projection
- [ ] Wallet stores metadata/settings only.
- [ ] Balance = Ledger projection.
- [ ] Wallet history = Ledger projection.
- [ ] No independent wallet balance truth remains.

### F8 — Income / Expense instrument
- [ ] Add direct manual income/expense command surface.
- [ ] Simple amount entry supported.
- [ ] Detailed quantity × unit price lines supported.
- [ ] Results are Operations + Ledger rows, not a parallel store.

### F9 — Loans / Investments / Returns / Transfers
- [ ] Loan received is cash IN but not operating revenue.
- [ ] Loan repayment is cash OUT but not ordinary operating expense.
- [ ] Investment received/returned are distinct economic types.
- [ ] Wallet-to-wallet transfer does not become business revenue/expense.

### F10 — Z-report
- [ ] Build day report from Ledger only.
- [ ] Support arbitrary period with the same projection engine.
- [ ] Show relevant article/economic/wallet breakdowns without creating report-owned facts.

### F11 — Browser/server/storage alignment
- [ ] One semantic Finance contract across browser and server.
- [ ] Server transaction is authoritative for money writes.
- [ ] Add concurrency-safe append persistence.
- [ ] Add roundtrip tests for discounts, corrections, partial payments, split wallets, tips, refund and cancel.
- [ ] Verify reload cannot create phantom debt or lose a payment.

### F12 — Guards, full regression, staging, release
- [ ] Guards reject a second payment owner, DDS owner, wallet balance owner or Record-owned money truth.
- [ ] Guards reserve Financial Model meaning and prevent operational imports/mutations.
- [ ] Full Check Book green.
- [ ] Staging smoke + manual payment/expense/refund/wallet/Z-report verification.
- [ ] Update PROJECT_STATE with final verified Finance ownership.
- [ ] Only then release staging -> main -> production.

## Financial Model reservation rule

Until a dedicated future project explicitly begins the Financial Model:

- do not create its implementation opportunistically;
- do not use its name for Settlement;
- do not use its plan/fact terminology for a single Record payment;
- do not make it a dependency of operational payment or Ledger commands;
- do not decide its UI placement merely because Finance is being rebuilt.

This reservation exists specifically so future Financial Model work can be added as a new analytical layer without rewriting the operational Finance core.
