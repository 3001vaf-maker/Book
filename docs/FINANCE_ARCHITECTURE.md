# Book — Finance Architecture

This file fixes the canonical responsibility boundaries for finance. Do not reintroduce parallel calculations or a Payment financial owner.

Current finance calculation owner: **Financial Model / Финансовая модель**.

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

**Tips do not belong to Record UI and do not increase procedure/client revenue.** They are an actual cash fact stored by DDS and later belong in the Z-report as a separate figure.

### Financial Model
`core/financial-model.js` owns financial plan/fact calculations.

Plan:
`source price - applied discount = planTotal / amount due`.

Fact is derived from DDS movements. Financial Model is the route for Client / Procedure / Product financial facts; those manifestations must not calculate DDS movements independently.

The client profile discount is the default discount source for a new Record. A master can correct the discount at payment stage. That correction belongs to the specific Record financial snapshot and does not automatically modify the permanent client-profile discount.

Financial Model also determines payment state for a Record:
- unpaid;
- partially paid;
- fully paid;
- remaining amount due.

### DDS
Owns actual cash movement history only:
- income now: payments, including received Tips as a separate field inside the cash fact;
- expense now: refunds;
- later: purchases and other expense/income movement types.

DDS does not own plan calculations. Each movement keeps the relevant Financial Model snapshot/context so historical attribution remains possible.

A payment movement keeps separate values for:
- actual money received into wallets;
- amount applied to the Record debt/service (`serviceAmount`);
- `Tips` — money received above the remaining amount due.

For example:
- amount due 7,000; cash received 10,000 -> serviceAmount 7,000; Tips 3,000;
- source price 7,000; discount 1,400; amount due 5,600; cash received 6,000 -> serviceAmount 5,600; Tips 400.

A refund reduces Tips first, then service payment. Therefore returning Tips alone must not reopen Record debt.

### Wallet
Owns wallet metadata/settings and its final cash balance. Wallet history/balance is a projection of movements received from DDS. Record never sends money directly to Wallet.

## Canonical flow

`Service/Procedure/Product price fact -> Record -> Financial Model plan -> Record financial snapshot -> Payment action -> DDS actual movement -> Wallet cash/history`

Actual fact flow:

`DDS -> Financial Model fact -> Client / Procedure / Product / Reports`.

Tips flow:

`Payment received above amount due -> DDS Tips fact -> Wallet cash/history -> later Z-report`.

Tips do not flow back into Record, Client revenue, or Procedure/Product revenue.

## Required example

Procedure price: 8,000.
Client profile discount: 20%.
Financial Model: discount 1,600; plan/due 6,400.
Record stores: 8,000 / 20% / 1,600 / 6,400.
Journal/day uses 6,400 as the economic amount.
Payment opens with 6,400.
DDS records service payment up to 6,400 and, if more cash is received, stores the difference separately as Tips.
Wallet receives all actual cash from DDS.
Client and Procedure actual contribution is based only on service payment through Financial Model fact, without Tips.

Partial payment example:
- due 7,000;
- received 2,000 -> Financial Model remaining = 5,000;
- Record bottom remains `К оплате 5 000 ₽` and uses the partial-payment warning state;
- later payments continue closing the same debt with separate immutable DDS income movements.

If the client profile had no discount and the master applies 20% only during payment, Financial Model recalculates the same chain, Record stores the corrected 8,000 / 20% / 1,600 / 6,400 snapshot first, then DDS records the actual payment.

A refund is a separate immutable DDS expense movement and reduces Wallet / Client / Procedure actual fact only by its service portion. A wrong payment is handled as refund -> new payment; payment editing/correction is not a financial concept in Book.

## Storage status

This responsibility model is canonical. Finance data is still browser-local transitional legacy until its controlled PostgreSQL migration. Browser storage is not the final owner architecture; server/database ownership must replace it without deleting existing production facts.
