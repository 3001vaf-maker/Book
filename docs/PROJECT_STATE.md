# Book — Project State

This file is the authoritative continuity anchor for Book. Read it before making architecture or product changes. Older repository documents may be obsolete and must not override this file or current code.

## Product essence

Book is a modular SaaS / anti-CRM for beauty professionals, starting from an independent master and expanding later to studios, salons and chains.

Architecture rule:

Core
→ functional module controller
→ data/state owner
→ shared UI
→ manifestation

One entity / one UI / one implementation. No local workaround when a rule belongs in Core/shared UI.

Book is the current technical tool name, not necessarily the future umbrella brand.

## Current launch mode

The current priority is to make the existing production Book a complete, usable daily work instrument before starting broader modules.

`main` is the production Book currently used with real data. Do not clear, reset or replace existing production browser data as part of feature work. All changes must preserve data already entered by Alexander.

A `develop` branch exists for future broader development, but the immediate launch-critical finishing work is being completed against the production product in small verified release blocks. Use a feature branch for the block, run CI, then merge once to `main` to minimize Amvera rebuild interruptions.

Do not spend launch time cleaning old repository documentation. `docs/PROJECT_STATE.md` is the authority.

## Current infrastructure

Frontend: existing Book application on GitHub Pages.
Backend: NestJS + PostgreSQL + Prisma modular monolith in `server/`.

Multi-tenant foundation:

Tenant / Business
→ Users
→ Membership / Role
→ Profile
→ Workplaces
→ Clients / Procedures / Records / Payments / Documents / ...

Every business entity must be isolated by `tenantId` on the server.

Production infrastructure:
- `book-api` on Amvera, Moscow-0
- `book-db` PostgreSQL on Amvera, Moscow-0
- frontend on GitHub Pages
- real OWNER authentication works against production API/PostgreSQL

`book-api` must normally remain running. The Amvera website/browser tab does not need to stay open.

## Production data rule — critical

Production Book now contains real data entered by Alexander. Some major business domains still use browser localStorage while authentication/tenant identity is server-backed.

Therefore:
- never run another production clean-start reset;
- never delete or silently replace current localStorage facts;
- any move from localStorage to PostgreSQL must first preserve and migrate the existing production facts;
- verify counts and critical fields before switching the source of truth;
- after migration there must be one canonical owner, not parallel local/server truth.

Current browser-owned domains include profile, clients, workplaces, procedures/history, timetable, records, wallets/payments and the initial Documents templates.

## Launch-critical sequence

Finish in this order:

1. Onboarding, including Documents between Procedures and Wallets.
2. Documents / agreements as a real working domain.
3. Client agreement history linked to real client profiles.
4. Finish the daily work contour: Profile, Procedures, Wallets/Payments, Timetable, Clients, Journal.
5. Finish payment editing, split payments, later payments and refunds/reversals.
6. Move launch-critical business facts safely to the server without losing current real data.
7. Add public online booking and minimum client self-service/history.
8. Connect Telegram for booking notifications and add notification-template settings.
9. Fix bugs found in real daily use.

Warehouse, Loyalty and other larger expansion modules remain parked until this sequence is operational.

## Production onboarding

The first login is onboarding, not the working application.

Before mandatory onboarding is complete:
- no bottom navigation;
- no general Main/Journal/Chat navigation;
- only the current onboarding workspace is visible.

Mandatory order:
1. Profile + Workplaces
2. Procedures
3. Documents / agreements
4. Wallet
5. Timetable / working days
6. Clients
7. Journal

Products are not a mandatory onboarding step.

After onboarding, every ordinary opening starts on Journal. Bottom navigation contains only: Main / Timetable / Journal / Settings.

## Documents / agreements

Documents is a real product module, not repository documentation.

Initial system document set:
- Agreement / information document for personal-data processing;
- Consent to personal-data processing — required client consent in the booking/client flow;
- Consent to informational messages — optional client consent.

Documents screen must also have `+` to create containers for additional future documents.

Book may provide editable starter templates, but they are deliberately general and must not be presented as guaranteed legally sufficient documents for every master. The product must warn that lawful personal-data processing requires a legal basis and that the template may need adaptation; recommend legal review for the exact business situation.

Do not state categorically that consent is the only legal basis in every case. The product should be conservative: before Book collects client personal data in its ordinary booking flow, it must obtain/record the required configured consent unless a separately designed lawful basis applies.

Client Profile agreements block must stop being decorative. It must eventually show real immutable consent facts: document/version, status, timestamp, source/channel and revocation where applicable.

## Daily work contour

Production-visible structure:
- Main → Clients → Client Profile
- Timetable → Calendar
- Journal → Day / Month / List
- Settings → Profile / Service / Documents / Wallet / Tags / booking-notification settings later

Hidden until ready:
- Chat
- Warehouse
- Loyalty program

Do not delete hidden modules; omit them from production manifestation/navigation until activated.

## Payments / finance — launch requirements

Existing payment facts must not be deleted to represent edits or refunds.

Required behavior:
- after a record is paid, the red unpaid state disappears;
- tapping the paid bottom modal/state opens payment management;
- actions: Edit payment and Refund payment;
- Edit payment reopens the payment flow; if the user exits without saving, the previous payment remains unchanged;
- Refund records how money was returned, to which wallet/method, full or partial amount;
- split payment supports at least two payment parts by default and adds another part only when a remainder remains;
- each part has amount + wallet; remainder recalculates automatically;
- later payment is supported: part may be paid now and the remaining balance later;
- refunds/reversals are immutable financial facts linked to the original payment, not deletion of history.

## Online booking — minimum launch scope

Profile automatically exposes a general public booking link.

`+` allows creation of a link scoped to a specific Workplace.

Public/client flow:
0.1 introduction: explain where the client arrived + Continue;
0.2 agreements: allow opening each document; required personal-data consent + optional communications consent;
0.3 minimal client form using the same client entity contract as Book; submitted data creates/links the client profile;
1. Workplace selection with descriptions;
2. Procedure multi-select;
3. Date selection using the shared calendar manifestation but without internal business-only UI;
4. Free slot selection — slots, not the duration/time wheel picker;
5. Confirmation.

Server must prevent double booking transactionally.

A client returning through their personal link/session should be able to see at least their appointment history. Future Beauty Journal/community content, articles and photo publishing are later enhancement work and not part of minimum launch.

## Telegram / notifications — minimum launch scope

Telegram bot is required initially for a minimal set of appointment notifications. It may later become the fifth bottom-navigation area, but do not expose that navigation item until the feature actually works.

Settings must gain a dedicated notifications/booking-messages folder for configuring the minimum appointment notification templates/rules. Messaging consent and channel rules must be centralized rather than creating separate business models for Telegram/WhatsApp/SMS.

## Account/profile identity rules

Authentication target:
- email or phone + password in one identifier field;
- email/phone uniqueness as required by server identity model;
- authenticated account email prefilled into first clean Profile;
- Profile provides `Изменить пароль` leading to current password → new password → repeat new password;
- only `passwordHash` server-side, never plaintext in Profile.

## Server migration order

When converting production facts from localStorage to PostgreSQL, preserve current real data and move in dependency order:
1. Profile + Workplaces
2. Procedures
3. Documents + consent facts
4. Wallets + payments/refunds
5. Timetable
6. Clients
7. Records / Breaks / Journal facts
8. Online-booking facts
9. Remove remaining production localStorage ownership only after validation

## Client history

Client history must be canonical chronological history derived from existing facts: Records, attendance/no-show, procedures, payments, refunds/reversals, consent/revocation facts and relevant notes/events. Do not invent parallel history models when existing facts can produce the history.

## Warehouse

Warehouse remains a major future module and should stay modular/autonomous enough to integrate with Book or another CRM. It is not launch-critical right now.

## UX / architecture constraints

- One shared modal system.
- One shared selector mechanism.
- One shared date/time picker; duration uses the shared duration picker.
- Shared Core/UI/CSS rather than local duplicates.
- Do not rename sections without an explicit reason.
- Do not delete implemented entities.
- Do not rollback more than necessary.
- Client identity: UEI if present, name/surname and phone where required; never display literal `UEI` prefix.
- Product behaves as an assistant, not a traditional CRM: guide creative users when a step or control is not self-evident.

## Validation rule

For each production release block:
1. work on a feature branch from current `main`;
2. run Check Book on the exact feature HEAD;
3. merge once into `main` only after the block is coherent;
4. verify exact `main` HEAD with Check Book and Deploy Book to GitHub Pages;
5. if backend files changed, wait for Amvera to return to `Запущено` and verify affected API/health before calling the release finished.

Never report a change as finished before the required checks pass.

## Working rule for future chats

Before continuing Book work, read this file and current `main`. Use it as the continuity authority so work does not depend on chat memory alone.
