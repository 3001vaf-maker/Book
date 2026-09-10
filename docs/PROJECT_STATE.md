# Book — Project State

This file is the continuity anchor for Book. Read it before making architecture or product changes.

## Product essence

Book is a modular SaaS for beauty professionals, starting from an independent master and expanding to studios, salons and chains.

Architecture rule:

Core
→ functional module controller
→ data/state owner
→ shared UI
→ manifestation

One entity / one UI / one implementation. No local workaround when a rule belongs in Core/shared UI.

Book is the current technical tool name, not necessarily the umbrella brand. The larger product vision is a beauty-industry community/ecosystem in which Book is one anti-CRM tool.

## Current production direction

Frontend remains the existing Book application.
Backend lives in `server/` and is being built as a modular monolith with NestJS + PostgreSQL + Prisma.

Multi-tenant foundation:

Tenant / Business
→ Users
→ Membership / Role
→ Profile
→ Workplaces
→ Clients / Procedures / Records / Payments / ...

Every business entity must be isolated by `tenantId` on the server.

Target production hosting is a Russian infrastructure provider/region so personal-data storage can be localized in Russia. Do not move client personal data or backups to foreign infrastructure by default.

Production and development must be isolated:
- development/staging uses a non-main branch, a separate preview URL and test data;
- production uses `main`, the production URL and production database;
- test data must never be copied into production;
- future real messaging integrations must not send from the development/staging environment.

## Current technical checkpoint

Current backend already includes:
- NestJS server
- Prisma/PostgreSQL foundation
- Tenant, User, Membership
- roles OWNER / ADMIN / MASTER
- JWT authentication
- `/auth/login`
- protected `/auth/me`
- owner bootstrap/seed flow
- health endpoint
- production Dockerfile
- production CORS via `FRONTEND_ORIGIN`
- server build inside Check Book CI

Current production infrastructure:
- `book-api` on Amvera, Moscow-0
- `book-db` PostgreSQL on Amvera, Moscow-0
- frontend on GitHub Pages
- real OWNER login works against production API/PostgreSQL

## Clean-start data decision

Current browser data is test data and does NOT need to be migrated into production.

Production Book starts with a clean server database. Alexander goes through the real product flow from zero and creates real data directly in the server-backed application.

Therefore:
- do not build a one-off migration for current test localStorage data;
- do not spend time preserving current test records, clients, payments or other test entities in production;
- migration work is about replacing localStorage ownership with server API ownership, not copying the current test dataset;
- use the clean start to validate the complete first-user journey from OWNER creation through daily work.

## Production onboarding gate

The first login is onboarding, not the working application.

Before all mandatory onboarding steps are completed:
- do not show bottom navigation;
- do not show Main, Journal, Chat or unfinished modules as general navigation;
- render only the current onboarding workspace.

Mandatory order:
1. Profile
2. Workplaces
3. Procedures
4. Wallet
5. Timetable / working days
6. Clients
7. Journal

Profile and workplace configuration may be presented together on the Profile screen because Workplaces are owned under Profile.

After mandatory onboarding is completed:
- the working application becomes available;
- every normal app opening starts on Journal;
- bottom navigation contains only: Main / Timetable / Journal / Settings.

Production-visible structure:
- Main → Clients → Client Profile
- Timetable → Calendar
- Journal → Day / Month / List
- Settings → Profile / Service / Documents / Wallet / Tags

Hidden until ready:
- Chat
- Warehouse
- Loyalty program

Do not delete hidden modules; remove them from production manifestation/navigation until activated.

Documents must become a working production folder and contain the previously intended agreement form. The exact agreement text/spec is not currently present in the repository continuity source; do not invent legal text without recovering or re-specifying it.

## Account/profile identity rules to retain

Future authentication must support at minimum:
- email + password;
- phone + password.

The login identifier can therefore be email or phone. Email/phone used for authentication are account identity fields and must be unique as required by the server model.

On first Profile creation, the authenticated account email should be prefilled into the clean Profile rather than entered twice.

Profile must later provide an `Изменить пароль` action that opens a dedicated password-change flow. Plain passwords are never stored in Profile; only server-side password hashes belong to account authentication.

## Current frontend source-of-truth that still needs replacement

Browser localStorage currently owns major data domains:
- profile
- clients
- workplaces
- procedures/history
- working days / timetable
- records
- wallets/payments

Replace these progressively with server API-backed owners. Keep existing frontend contracts where useful and avoid parallel local/server truth.

Production replacement order follows the mandatory first-user journey:
1. Profile + Workplaces
2. Procedures
3. Wallets
4. Working days / timetable
5. Clients
6. Records / Breaks / Journal facts
7. Remove remaining production dependence on localStorage

## Known unfinished product areas — do not forget

These are not discarded. They are parked while the server foundation is built.

### Client history
Client card/history is still incomplete. It must eventually show a canonical chronological history derived from real facts such as Records, attendance/no-show, procedures, payments, refunds/reversals and relevant notes/events. Do not invent a second history data model if existing domain facts can produce it.

### Finance block
Finance is not finished. Existing Wallet and Payment facts are only the base. The future finance owner must include transactions, refunds/reversals as immutable financial facts, reporting and proper tenant isolation. Do not delete payment history to represent a refund.

### Modular entry / onboarding
Onboarding must interpret user input into canonical Book entities rather than becoming an independent CRM/data model. It is a manifestation/controller over Profile, Workplaces, Procedures, Wallets, Timetable and Clients.

### Warehouse
Warehouse is a major future module and must stay modular/autonomous enough to integrate with Book or another CRM. It includes suppliers, items/materials, batches/lots, stock movements, recipes/consumption, historical cost, inventory, depreciation and replenishment analytics.

### Online booking
Future public route concept: `/booking/:publicProfileId`.
Flow: master/workplace → procedure → date → time → name/phone → confirm.
Server must prevent double booking transactionally.

### Communications / marketing
Messaging channels and consent must be modeled centrally. Telegram/WhatsApp/SMS are channels, not separate business models. Do not force the master to become a blogger or use discount marketing.

## UX / architecture constraints that remain active

- One shared modal system.
- One shared selector mechanism.
- One shared date/time picker.
- Shared core/UI/CSS instead of local copies.
- Do not rename sections without an explicit reason.
- Do not delete existing implemented entities.
- Do not rollback more than necessary.
- Client identity: UEI if present, name/surname and phone where required; never display literal `UEI` prefix.

## Validation rule

After repository changes, verify the exact latest commit with:
- Check Book
- Deploy Book to GitHub Pages

Do not report a change as finished until both succeed for the exact latest HEAD.

## Working rule for future chats

Before continuing Book work, read this file and current `main`. Use this file as the project continuity anchor so the work does not depend on chat memory alone.
