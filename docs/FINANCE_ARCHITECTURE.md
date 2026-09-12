# Book — Finance Architecture

This file fixes the current canonical responsibility boundaries for finance.

## Canonical owner

Finance is one complex Core domain:

`core/finance/`

Only `core/finance/index.js` is public outside the domain.

Internal responsibilities:
- `model.js` — financial plan/fact model and derived payment state;
- `data.js` — persistence of finance facts;
- `read.js` — finance projections/read model;
- `rules.js` — pure finance rules and calculations;
- `service.js` — finance commands/actions;
- `index.js` — the only public domain contract.

Do not reintroduce old parallel owners such as top-level `core/dds.js`, `core/financial-model.js` or `core/payment.js`.

## Ownership

### Service / Procedure / Product
Own the source price fact. They do not calculate cash movement history.

### Record
Owns the appointment and stores the financial snapshot for that appointment. Record does not own financial formulas and does not move money.

The snapshot preserves the chain needed for history/export, including source item/price, applied discount, plan/amount due and hydrated actual fact totals.

### Finance Model
Owns plan/fact calculations and payment state.

Plan:

`source price - applied discount = planTotal / amount due`

A payment-stage discount changes the financial snapshot of that Record; it does not automatically change the permanent client-profile discount.

### DDS facts
Actual money movements are finance facts persisted inside the Finance domain.

Current movement semantics include:
- payment income;
- refund expense;
- cancelled erroneous operations retained as history but excluded from active calculations;
- Tips as actual cash separate from service revenue.

Payment/refund history is immutable. Wrong payment is handled through cancel/refund semantics defined by current Finance Core rather than destructive history editing.

### Wallet
Wallet owns wallet metadata/settings and exposes its balance/history as a projection of Finance/DDS movements. Record never sends money directly to Wallet.

## Canonical flow

`Service/Procedure/Product price -> Record -> Finance model -> Record snapshot -> Finance movement -> Wallet projection`

Actual fact flow:

`Finance movements -> Finance read/model -> Client / Procedure / Product / Reports`

## Tips

Tips are actual cash facts. They increase wallet cash but do not increase Record debt, client service revenue or procedure/product revenue.

If received cash is above the remaining amount due, the excess is Tips. Refund logic preserves the current Finance Core semantics and must not be recreated in UI.

## Partial payment

A Record may have multiple immutable income movements until its debt is closed. Remaining amount is derived by Finance Core; Journal/payment UI only displays/collects input.

## Storage status

Finance business data is server-owned. Browser storage is not a Finance data owner. Server hydration/persistence goes through the current server state APIs and shared persistence queue.

The browser-storage architecture guard and Finance architecture guard are part of Check Book and must fail if browser business ownership or old parallel finance owners return.
