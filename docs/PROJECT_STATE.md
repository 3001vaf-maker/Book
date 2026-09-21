# Book — Current Project State

This file is the compact continuity anchor for Book. Current `main`, current code and current Check Book guards are the source of truth.

## Production

- `main` is production.
- Frontend: GitHub Pages.
- Backend: NestJS + PostgreSQL + Prisma on Amvera.
- Business/application data is server-owned.
- Browser storage is limited to approved technical/session/UI state.
- Legacy browser business keys are purged only by `core/legacy-browser-business.js` after all server domains are verified.
- Do not use production as a development environment.

## Development / release rule

Permanent integration branch: `staging`.

Work must follow:

`feature/* -> PR to staging -> Check Book -> staging verification -> release PR to main -> one production deployment`

Do not push intermediate development commits to `main`. Short-lived feature branches are deleted after merge.

Local staging is isolated from production and uses its own PostgreSQL database, local backend and local frontend. Details: `docs/DEVELOPMENT_WORKFLOW.md`.

## Architecture

Canonical complex domains use one public contract:

`core/<domain>/ -> internal atoms -> index.js`

Current canonical domain folders include:
- `core/day/`
- `core/time/`
- `core/record/`
- `core/finance/`

Manifestation/UI folders do not own domain persistence or business rules.

One entity / one owner / one implementation. Shared UI stays shared; no local workaround for Core/UI ownership problems.

Profile is profession-neutral. Profession exists only as Profile.profession data and must never become a system entity, role, route, identifier, generic screen/header/title, or architecture branch. Ambiguous profession-based product wording must be clarified before implementation.

## Server-owned business state

Server ownership is active for the production business contour, including:
- Profile + Workplaces
- Clients / Person
- UEI identity links
- Records + lifecycle events
- Day / WorkPlan + Breaks
- Procedures + history
- Booking settings
- Finance / DDS
- Wallets
- Tags
- Products + history
- Documents / Consents / history
- Online-booking account/request facts

The old browser-to-server migration phase is complete. Do not restore browser business ownership or legacy browser fallback paths.

## Finance

Finance is under an ordered ownership rebuild. The single canonical contract and checklist are in `docs/FINANCE_ARCHITECTURE.md`.

Target ownership:
- Settlement / Расчёт — accrued / due / paid / refunded / outstanding calculation for a concrete source;
- Ledger / DDS — every factual money movement;
- Operation — grouping of related Ledger rows;
- Articles — user-extensible hierarchy plus system economic character;
- Wallet / Касса — metadata only; balance/history are Ledger projections;
- Z-report — Ledger projection for a day/period;
- Financial Model / Финансовая модель — RESERVED future planning/analysis instrument, not operational payment logic.

Record is not a money owner. It supplies appointment/source facts and snapshots; Finance owns payment commands and money facts.

F2 removes the legacy `core/finance/model.js` and Record-oriented FinancialPlan API. Operational calculation is `Settlement / Расчёт`. Legacy persisted JSON field names remain temporarily for storage compatibility only.

The user-facing Finance folder remains `main/finance/`. The future Financial Model may later be manifested under Finance or a future Analytics folder; this UI placement is intentionally undecided.

## Production-visible contour

- Main: Clients, Finance
- Timetable
- Journal: Day / Month / List
- Settings: Profile, Service, Documents, Online booking, Tags and related current settings
- Public online booking

## Parked product areas — KEEP

These are intentional future product surfaces and are not repository garbage:
- `chat/` — reserved for the Chat surface and future chatbot integration;
- `settings/warehouse/` — future Warehouse;
- `settings/loyalty/` — future Loyalty expansion.

Do not delete a parked module merely because it is hidden or currently contains only a placeholder implementation.

## Repository hygiene

Keep:
- runtime source;
- `tests/` and `scripts/` used by Check Book;
- `.github/workflows/`;
- Prisma schema and every applied Prisma migration;
- canonical architecture/design/UI dictionaries;
- intentional parked product modules.

Do not keep:
- completed task specifications/TZ files after implementation;
- obsolete migration instructions in documentation;
- abandoned compatibility owners;
- duplicate architecture documents;
- backup branches used only as temporary snapshots.

Git history and merged pull requests preserve implementation history; the production tree should contain only current code, current guards and current documentation.

## Current infrastructure checkpoint

The isolated development contour now exists in code:
- `staging` is the permanent integration branch;
- localhost frontend automatically targets localhost API, never production Amvera;
- `docker-compose.staging.yml` creates an isolated PostgreSQL/backend/frontend stack;
- staging fixtures contain synthetic profile/workplace/client/record/payment data;
- Check Book runs on pushes and PRs for both `staging` and `main`.

The previously queued Auth transactional communication block is paused.

## Active block — Finance ownership rebuild (2026-09-20)

Release-candidate base: `staging@5562cdc1a110184f2e92dfd39b6ac3ac3d7ad8a9` (PR #246 merged). The docs-only Finance closeout commit created from this base is the exact staging head that must pass the final whole-staging Check Book before `main`.

Working branch: none — Finance F0-F12 is complete in `staging`; final whole-staging release verification is pending before `main`.

Continuity anchor: `docs/FINANCE_ARCHITECTURE.md`.

Current status:
- F0: DONE — canonical Finance ownership and ordered F0-F12 migration chain are documented and merged to `staging` as `522b593d9c5d1a1ea37b152b8f0802389eeb81e8`; post-merge Check Book #1968 passed all three jobs.
- F1: DONE — verified ownership/storage/formula inventory and current-owner -> target-owner migration map are recorded in `docs/FINANCE_ARCHITECTURE.md`; merged to `staging` as `02bd8e6b0ab82048335d1a29be8e9186a4b614bb`; post-merge Check Book #1972 passed all three jobs.
- F2: DONE — legacy operational Financial Model/FinancialPlan naming is replaced by `Settlement / Расчёт`; `core/finance/model.js` is removed; guards block the old API and operational Financial Model dependencies. Exact-head Check Book #1977 and post-merge Check Book #1978 both passed all required jobs on `staging@b075c9bf2203d839d5dc9cba6153aa7ab705a893`.
- F3-F5: DONE — merged to `staging` as `b3819f4033424cec502244b667781e004d5796a0`. Record no longer owns payment truth; canonical server `FinanceSettlement`, `FinanceOperation` and flat `FinanceLedgerEntry` own Settlement, operations and factual money rows; payment/refund/cancel are server-owned; split-wallet payment is one Operation with multiple Ledger rows; Wallet/DDS project from Ledger; legacy auxiliary Finance is migration-only. Combined feature Check Book #1989 and post-merge Check Book #1990 both passed all required jobs, including migration, backend, four production domains and staging frontend.
- F6-F8: DONE — merged to `staging` as `18af1dee4f127e00f720dfd522835b5e2c3e0258` via PR #245. Server-owned hierarchical `FinanceArticle` catalog separates custom names from `direction`/`economicType`; manual Income/Expense writes one FinanceOperation with one or many flat Ledger rows; simple amount and detailed quantity × unit price entry are supported; Wallet/Cash remains metadata-only with balance/history projected from Ledger. Feature Check Book #1993 and post-merge Check Book #1994 both passed all required jobs, including migration, backend, four production domains and staging frontend.
- F9-F11: DONE — merged to `staging` as `5562cdc1a110184f2e92dfd39b6ac3ac3d7ad8a9` via PR #246. Loans, loan repayments, investments, investment returns and wallet transfers use canonical Operation + Ledger semantics; Z-report is a Ledger-only day/period projection; browser/server cent rounding is aligned; authoritative money writes use Serializable transactions with retry; roundtrip regressions cover stale Record finance, partial/split/tips/refund/cancel/reload; all factual operations separate mandatory `occurredAt` from system `recordedAt`, so late Record closure does not move historical income. Feature Check Book #1996 and post-merge Check Book #1997 both passed all required jobs.
- F12: DONE ON STAGING — final guards, regression, migration, backend, four production-domain checks and staging frontend all passed in #1996 and #1997. Release to `main` remains blocked until one additional whole-staging Check Book passes on the exact Finance closeout head.
- F0-F1 changed documentation only. F2 renamed the operational calculation owner to Settlement. F3-F5 moved payment truth to Settlement + Operation + flat Ledger. F6-F8 added Articles and direct manual Income/Expense on the same Ledger. F9-F11 add special capital operations, Z-report, concurrency/roundtrip alignment and the factual-time/audit-time contract without introducing another money owner.
- `main` must not receive this rebuild until the exact Finance closeout staging head passes one additional complete Check Book. After that, open `staging -> main`, require its PR checks green, and only then merge.

Non-negotiable ownership:
- Record does not own money movement or payment truth.
- Settlement owns amount-due / paid / debt calculation for a concrete source.
- Ledger/DDS owns factual money movement.
- Wallet balance/history are Ledger projections.
- Financial Model is reserved for a future plan/fact analytical instrument and must not be reused for Settlement.
- Future Financial Model UI placement (Finance vs future Analytics) remains intentionally undecided.
- Workplace owns rent conditions/cadence; Finance owns only factual rent money movements; future Financial Model may consume Workplace rent conditions for planned costs.
- Every factual Finance Operation owns mandatory real-world `occurredAt`; Book owns immutable audit `recordedAt`. Daily/period reporting uses `occurredAt`.

Verification rule:
- make the coherent implementation block first;
- run targeted tests/guards while building the block;
- run one complete Check Book for the whole block before merge to `staging`;
- run one post-merge Check Book on `staging`;
- do not repeat full four-domain smoke for every small F step inside the same coherent block;
- merge to production `main` only after the entire Finance rebuild is complete and verified.

## Completed block — Record ownership cleanup (2026-09-20)

Source checkpoint: `main@fcd7d748bfdd5bb01be832927c52237fb8816ad8`.

Working branch: `feature/record-ownership-cleanup-20260920`.

### Non-negotiable product model

There is exactly one `Record` domain and one `recordId` for one appointment.

Creation channel is not a Record type. A Record can originate from Journal, Online Booking, Telegram, API or another future entry point, but all entry points must call the same canonical Record command path.

The subject and the actor are different facts:
- Person = who is booked / who the appointment is for;
- actor = who performed the action;
- for owner-side Journal actions the actor must preserve the concrete Profile identity, not only a generic owner/master label;
- source/origin preserves where the action came from, e.g. JOURNAL or ONLINE_BOOKING.

UI is manifestation only. Journal/List and Account/History must read the same Record result and must never calculate separate lifecycle truth.

### Flat result / deep history rule

For export/reporting, one Record must be reducible to one wide result row containing its current/final facts: person, appointment date/time, selected service snapshots, total duration, financial result, lifecycle/attendance/payment state and relevant action metadata.

Under the hood, history may be append-only: one immutable action/fact per history row. Those rows must be sufficient to explain how the final Record result was reached.

Action, lifecycle status, attendance and payment are separate concepts and must not be collapsed into one field.

### Product stage invariant: one Profile now, scalable later

Current implementation stage is the single-user/single-Profile product stage. System architecture and generic code must remain profession-neutral; do not encode profession names, salon names or role-specific labels into Record, routes, identifiers or generic UI.

Current stage:
- one Tenant / business container;
- one PlatformAccount;
- one Profile;
- that Profile may work across multiple Workplaces;
- Record actions are therefore currently performed by that one Profile, but must still store the concrete Profile/Account identity.

Future business stage:
- one Tenant / business container may have multiple PlatformAccounts and Profiles;
- permissions decide which users may create, move, cancel or otherwise act on Records;
- Workplaces become business-owned locations/resources rather than being conceptually owned by one individual Profile;
- a business may have one or many Workplaces;
- Profiles/users may be assigned access to one or more Workplaces.

Record must not depend on which product stage is active. It must keep these independent references:
- `workplaceId` = where the appointment happens;
- `actorProfileId` / `actorAccountId` = who performed the action;
- `personId` / Person reference = who the appointment is for.

Therefore future changes to Workplace ownership or multi-user permissions must not require rewriting Record history.

### Canonical ownership target

- Person: who is booked.
- Service/Procedure: catalog source for current service identity, price and duration.
- Record: appointment identity, person link/snapshot, appointment date/time, workplace, selected service snapshots and origin link.
- Record History: who did what, when, through which source, and before/after values needed for audit/history.
- Day: working date and working interval.
- Time: the only availability/overlap/occupancy rules.
- Finance: the only price-plan/discount/payment/refund calculations and money facts.
- BookingRequest: pre-Record request/transport only; after successful creation it keeps the resulting `recordId` and must not own Record lifecycle, payment state or current appointment truth.
- Journal/List: owner-side view only.
- Account/History: person-side view only of the same Record projection.

### Confirmed current defects

1. Manual Record creation goes through `core/record/service.js::createRecord()`, but Online Booking has a separate Record constructor in `BusinessStateService.createOnlineBookingRecord()`.
2. BookingRequest duplicates Record facts (`date/from/to/procedures/recordSnapshot/status`) and Account history uses that duplicate state after a real Record exists.
3. `manualRecordViews()` reshapes real Records into BookingRequest-shaped objects for Account history.
4. Record history has CREATED/CONFIRMED/UNCONFIRMED/ARRIVED/NO_SHOW/ATTENDANCE_CLEARED/CANCELLED, but move/reschedule overwrites Record date/time without an immutable RESCHEDULED fact.
5. Current Record events do not consistently preserve actor Profile/Account/System identity or source channel.
   - Prisma Profile already has a real `id`, but the server Profile bundle and browser `normalizeProfile()` currently omit it.
   - `workplaceDto()` currently emits `profileId: 'profile'` instead of the real Profile id.
   - Current Prisma also enforces one Profile per `(tenantId, platformAccountId)`. Multi-profile support is therefore a later Profile architecture change, but Record history must use a real `actorProfileId` now so it will scale without rewriting history.
6. Browser Journal uses canonical `core/time/`, while server Online Booking reimplements time parsing/range/overlap and availability checks.
7. Finance Core is canonical for normal Records, while Online Booking reimplements price/discount/plan calculations in `initialRequestSnapshot()` and `bookingFinance()`.
8. Account UI independently derives lifecycle/payment labels from BookingRequest/date/snapshot, creating a second business-rule owner.
9. Prisma persistence names `BusinessRecord` / `BusinessRecordEvent` are legacy BusinessState naming. Treat naming cleanup separately from behavioral cleanup so persistence is not destructively changed by accident.
10. Current Workplace persistence is tied to Profile (`Workplace.profileId`). This is acceptable for the current single-Profile stage, but future business-stage ownership must be able to move to the Tenant/business container without changing Record semantics. Record must depend only on stable `workplaceId`, never on the assumption that Workplace belongs to the acting Profile.

### Ordered cleanup chain

**R0 — Freeze the contract**
- Keep this section as the continuity anchor.
- Do not modify `main` directly.
- Do not rename persistence or delete compatibility paths before replacement behavior is verified.

**R1 — Complete Record facts/history**
- Define the canonical Record command/event contract.
- Preserve Person (subject), actor identity, source/origin, action time and appointment time as distinct facts.
- Add RESCHEDULED history with before/after date/time/workplace.
- Ensure create/cancel/attendance/confirmation history has sufficient actor/source metadata.
- Expose the current real Profile id through the existing Profile read contract; do not invent a second profile identifier.
- Add tests for: create -> reschedule -> cancel and create -> arrived/no-show.
- No Booking, Time or Finance redesign in this step.

**R2 — Unify Time ownership**
- Keep `Day` as owner of working date/interval.
- Keep `core/time/` semantics as the canonical availability/overlap contract.
- Remove parallel Online Booking time formulas by routing server validation through the same canonical rules/contract.
- Preserve double validation (browser display + server authority), but never two different algorithms.
- Test Journal and Online Booking against the same occupied/free scenarios.

**R3 — Unify Finance ownership**
- Service/Procedure supplies current catalog price/duration.
- Record captures immutable service price/duration snapshots at booking time.
- Finance alone calculates discount, plan/amount due, payment, refund and remaining balance.
- Remove Online Booking mini-finance calculations.
- Account must consume Finance result by `recordId`, not snapshot payment arithmetic.
- Test later catalog price changes do not rewrite historical Record price.

**R4 — One canonical Record creation path**
- Replace separate manual vs online Record constructors with one canonical Record command path.
- Journal, Booking and future Telegram/API are callers, not owners.
- Journal-originated events preserve concrete Profile identity.
- Online Booking-originated events preserve Account identity and source.
- Keep one `recordId` regardless of source.

**R5 — Reduce BookingRequest to pre-Record transport**
- BookingRequest may hold temporary selection while the request is being validated/created.
- On success it links to `recordId`.
- After Record creation it must not determine Record lifecycle/current status/payment/current date/time.
- Remove `recordSnapshot` as a post-create source of truth and retire manual Record-to-BookingRequest view adapters.

**R6 — One Record read/projection**
- Build one canonical Record result/projection from Record + Record History + Finance facts.
- Journal/List and Account/History consume that same projection with different field visibility/filtering only.
- Cancelled Record must be cancelled on both sides and must never become Account debt merely because appointment time passed.

**R7 — Persistence/name cleanup**
- Only after behavior is verified, clean legacy `BusinessRecord` / `BusinessRecordEvent` naming.
- Prefer a non-destructive migration/mapping strategy where possible.
- Do not create a second Record entity while renaming storage.

**R8 — Guards, regression and release**
- Strengthen Check Book so a second Record creator, Time algorithm, Finance calculator or Account lifecycle calculator cannot return.
- Verify Record/History, Journal/List, Account/History, Time occupancy, Finance payment/refund and Online Booking.
- Run full checks and staging verification.
- Only after all checks pass: release through staging -> main -> production.

### Implementation status (2026-09-20)

- R0: DONE — contract and continuity anchor fixed in this file.
- R1: DONE in branch — Record history distinguishes action/status/attendance; RESCHEDULED stores before/after; Journal sends real Profile/PlatformAccount actor identity; CREATED/CANCELLED/attendance preserve actor/source/Person context.
- R2: DONE in branch — server TimeService owns authoritative availability rules; Online Booking no longer contains its own overlap/range algorithm or final occupancy decision.
- R3: DONE in branch — ProcedureService supplies booking-time service snapshots; FinanceService owns plan/payment state; Online Booking no longer calculates a Record finance snapshot.
- R4: DONE in branch — server RecordService is the one canonical Record constructor used by Online Booking and by initial owner-side Record persistence.
- R5: DONE in branch — BookingRequest is transport/linkage only after creation; runtime recordSnapshot ownership, owner snapshot bridge and synthetic manualRecordViews adapter are removed.
- R6: DONE in branch — Account history reads canonical Records by Person identity, including cancelled Records, and consumes Record lifecycle + Finance result rather than BookingRequest state.
- R7: DONE in branch — Prisma model names are Record / RecordEvent while existing physical table names remain mapped with @@map, avoiding destructive DB migration.
- R8: DONE — PR #220 verification reached full green on Check Book run #1909 (`f03516bc09b1a2743b767cf26057a1b8fcf2186c`): `check`, `profile-migration-upgrade`, and `staging-smoke` all succeeded. Staging smoke successfully built the backend, started isolated PostgreSQL + backend, verified the backend, verified all four production-domain host routes, started and verified the staging frontend, and cleaned up.

Important compatibility detail:
- Browser Journal remains an optimistic client surface for the current product stage, but first persistence of a new row is canonicalized by server RecordService. Browser-created CREATED history is semantically deduplicated against the server-created CREATED fact.
- Existing physical tables are intentionally retained during this cleanup. Product/domain naming is Record / RecordEvent.

### Verified result

The ownership cleanup is considered complete only when the final branch head is green. The last behavior-changing head verified green was `f03516bc09b1a2743b767cf26057a1b8fcf2186c` in Check Book run #1909. Any later documentation-only commit must still receive a final green PR check before merge.

Resulting ownership:
- one Record / one recordId per appointment;
- one canonical server Record constructor;
- Record History stores action facts with actor/source/subject context and reschedule before/after;
- Time owns final availability;
- Procedure owns service price/duration source; Record stores the booking-time snapshot;
- Finance owns plan/payment/refund state;
- BookingRequest is transport/linkage only after Record creation;
- Account History reads canonical Records, not BookingRequest snapshots;
- Prisma uses neutral Record / RecordEvent model names mapped to the existing physical tables.

### Stop rule

At every step, finish tests and inspect the diff before moving to the next step. Do not combine later steps opportunistically. If an unexpected ownership dependency appears, document it here first, then decide which step owns it.
