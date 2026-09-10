# Book — Finance Architecture

This file fixes the canonical responsibility boundaries for finance. Do not reintroduce parallel calculations or a Payment financial owner.

Terminology rule: the current finance core uses **Financial Model / Финансовая модель**. The term **Business Model / Бизнес-модель** is reserved for a future advanced Analytics instrument for growth/potential design and must not be used for current finance logic.

## Ownership

### Service / Procedure / Product
Owns the source price fact. It is not a financial instrument.

Example: procedure price selected/set by the master = 8,000.

### Record
Owns the appointment fact and stores the financial snapshot returned by Financial Model for this appointment. Record does not calculate finance and does not move money.

The snapshot must preserve the complete chain needed for history/export:
- source item and price;
- applied discount mode / percent / rubles;
- discount total;
- amount due / plan total;
- hydrated actual fact totals for display/export.

Changing a payment-stage discount must update this Record snapshot before the payment movement is written.

### Financial Model
`core/financial-model.js` owns financial plan/fact calculations.

Plan:
`source price - applied discount = planTotal / amount due`.

Fact is derived from DDS movements. Financial Model is the route for Client / Procedure / Product financial facts; those manifestations must not calculate DDS movements independently.

The client profile discount is the default discount source for a new Record. A master can correct the discount at payment stage. That correction belongs to the specific Record financial snapshot and does not automatically modify the permanent client-profile discount.

### DDS
Owns actual cash movement history only:
- income now: payments;
- expense now: refunds;
- later: purchases and other expense/income movement types.

DDS does not own plan calculations. Each movement keeps the relevant Financial Model snapshot/context so historical attribution remains possible.

### Wallet
Owns wallet metadata/settings and its final cash balance. Wallet history/balance is a projection of movements received from DDS. Record never sends money directly to Wallet.

## Canonical flow

`Service/Procedure/Product price fact -> Record -> Financial Model plan -> Record financial snapshot -> Payment action -> DDS actual movement -> Wallet cash/history`

Actual fact flow:

`DDS -> Financial Model fact -> Client / Procedure / Product / Reports`.

## Required example

Procedure price: 8,000.
Client profile discount: 20%.
Financial Model: discount 1,600; plan/due 6,400.
Record stores: 8,000 / 20% / 1,600 / 6,400.
Journal/day uses 6,400 as the economic amount.
Payment opens with 6,400.
DDS records +6,400 when paid.
Wallet receives +6,400 from DDS.
Client and Procedure actual contribution becomes 6,400 through Financial Model fact.

If the client profile had no discount and the master applies 20% only during payment, Financial Model recalculates the same chain, Record stores the corrected 8,000 / 20% / 1,600 / 6,400 snapshot first, then DDS records +6,400.

A refund is a separate immutable DDS expense movement and reduces Wallet / Client / Procedure actual fact. A wrong payment is handled as refund -> new payment; payment editing/correction is not a financial concept in Book.

## Storage status

This responsibility model is canonical. Finance data is still browser-local transitional legacy until its controlled PostgreSQL migration. Browser storage is not the final owner architecture; server/database ownership must replace it without deleting existing production facts.
