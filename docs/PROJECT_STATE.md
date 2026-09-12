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

## Release rule

Work must follow:

`feature/staging branch -> Check Book -> staging/manual verification -> merge to main -> one production deployment`

Do not push intermediate development commits to `main`.

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

## Current next infrastructure direction

Before substantial new production features, establish a development/staging contour isolated from production Amvera/database. Auth transactional notifications (registration verification / password reset / security notifications) should be developed and verified there before a production release.
