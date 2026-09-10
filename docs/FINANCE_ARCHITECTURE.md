# Book — Finance Architecture

This file fixes the canonical responsibility boundaries for finance. Do not reintroduce parallel calculations or a Payment financial owner.

## Ownership

### Service / Procedure / Product
Owns the source price fact. It is not a financial instrument.

Example: procedure price selected/set by the master = 8,000.

### Record
Owns the appointment fact and stores the financial snapshot returned by Business Model for this appointment. Record does not calculate finance and does not move money.

The snapshot must preserve the complete chain needed for history/export:
- source item and price;
- applied discount mode / percent / rubles;
- discount total;
- amount due / plan total;
- hydrated actual fact totals for display/export.

Changing a payment-stage discount must update this Record snapshot before the payment movement is written.

### Business Model
Owns plan/fact calculations.

Plan:
`source price - applied discount = planTotal / amount due`.

Fact is derived from DDS movements. Business Model is the route for Client / Procedure / Product analytics; those manifestations must not calculate DDS movements independently.

The client profile discount is the default discount source for a new Record. A master can correct the discount at payment stage. That correction belongs to the specific Record financial snapshot and does not automatically modify the permanent client-profile discount.

### DDS
Owns actual cash movement history only:
- income now: payments;
- expense now: refunds;
- later: purchases and other expense/income movement types.

DDS does not own plan calculations. Each movement keeps the relevant Business Model snapshot/context so historical attribution remains possible.

### Wallet
Owns wallet metadata/settings and its final cash balance. Wallet history/balance is a projection of movements received from DDS. Record never sends money directly to Wallet.

## Canonical flow

`Service/Procedure/Product price fact -> Record -> Business Model plan -> Record financial snapshot -> Payment action -> DDS actual movement -> Wallet cash/history`

Actual fact analytics flow:

`DDS -> Business Model fact -> Client / Procedure / Product / Reports`.

## Required example

Procedure price: 8,000.
Client profile discount: 20%.
Business Model: discount 1,600; plan/due 6,400.
Record stores: 8,000 / 20% / 1,600 / 6,400.
Journal/day uses 6,400 as the economic amount.
Payment opens with 6,400.
DDS records +6,400 when paid.
Wallet receives +6,400 from DDS.
Client and Procedure actual contribution becomes 6,400 through Business Model fact.

If the client profile had no discount and the master applies 20% only during payment, Business Model recalculates the same chain, Record stores the corrected 8,000 / 20% / 1,600 / 6,400 snapshot first, then DDS records +6,400.

A refund is a separate immutable DDS expense movement and reduces Wallet / Client / Procedure actual fact. A wrong payment is handled as refund -> new payment; payment editing/correction is not a financial concept in Book.

## Storage status

This responsibility model is canonical. Finance data is still browser-local transitional legacy until its controlled PostgreSQL migration. Browser storage is not the final owner architecture; server/database ownership must replace it without deleting existing production facts.
