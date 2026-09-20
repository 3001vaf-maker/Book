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

Finance ownership lives under `core/finance/`:
- `model.js` — plan/fact calculations;
- `data.js` — persistence boundary;
- `read.js` — projections/read model;
- `rules.js` — pure financial rules;
- `service.js` — financial commands/actions;
- `index.js` — only public contract.

DDS movements are finance facts; Wallet is wallet metadata/balance projection; Record stores appointment financial snapshot. Do not reintroduce old parallel owners such as top-level `core/dds.js` or `core/financial-model.js`.

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

The previously queued Auth transactional communication block is paused. The active functional block is the Record ownership cleanup below.

## Active block — Record ownership cleanup (2026-09-20)

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

### Stop rule

At every step, finish tests and inspect the diff before moving to the next step. Do not combine later steps opportunistically. If an unexpected ownership dependency appears, document it here first, then decide which step owns it.
