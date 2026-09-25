# End-user UI cleanup plan

## Scope

Only the end-user contour: global entry, online booking, account/profile, representatives/spaces, history, chat, notifications, personal data, password, consents/documents and the Shared UI owners they use.

Do not change professional, platform or admin behavior as part of this cleanup unless a shared owner must be fixed for the end-user contour.

## Non-negotiable UI rule

System/technical messages use one Shared V2 presentation:

- full-screen H background;
- one white sticker centered on the screen;
- sticker has a visible floating shadow;
- no browser-native alert/confirm/prompt/validation bubble;
- no raw backend exception text.

A/B/C/D/Z/F/E geometry, folder hierarchy and gesture behavior are out of scope for Stage 1.

## Stage 1 — safety before external distribution

Status: DONE in `main@cad049020c656add2a649df65f0f7dbe3e6d620a`.

Goal: remove accidental browser/system/technical output without changing application geometry or business flows.

Work:
- replace native browser validation bubbles with shared validation;
- route technical/system notices through the H + centered white sticker V2 surface;
- sanitize account API errors so raw backend/exception text cannot reach the end user;
- remove unfinished technical copy from visible UI;
- extend CI guard to cover `online-booking/`, `prompt`, `reportValidity`, and `setCustomValidity`;
- verify syntax/tests and all four production domains before any merge to `main`.

Stage 1 must not:
- change A/B/C/D/Z/F/E geometry;
- change FE/Z gesture ownership;
- reorganize screens;
- delete legacy shared code merely because it looks old;
- merge to `main` before the full verification matrix is green.

## Stage 2 — move active local UI into Shared UI

Status: DONE in `main@c8f0b5d49858eb405cdb88db1e8e3c4c5540a37a`.

Goal: remove local/legacy presentation owners without changing business flows.

Completed:
- `ui/chat` is the single Chat UI owner for both end-user and professional contours: bubbles, thread, composer, attachments, attachment validation, growing text area and Chat-specific geometry.
- End-user and professional Chat import `ui/chat` directly. No Chat bridge remains in `ui/ui.js`.
- Professional Chat now uses the same V2 visual shell as end-user Chat; professional-only functions remain professional-only.
- Chat Header A owns Chat settings. Shared Header C/D own contextual actions/attachments.
- Chat text input grows with content up to its max height; native blue focus rings are suppressed.
- `ui/settings` is the single owner for settings panels/toggles used by migrated contours.
- `ui/receipt` is the single owner for read-only receipt/report sheets used by the end-user contour.
- `ui/forms` is the single owner for reusable form shells and form-error presentation in the end-user identity/profile flows and professional Chat management forms.
- Legacy Chat/Settings/Receipt code and their migrated CSS were physically removed from `ui/shell`; no compatibility wrapper was left behind.
- Old Chat shell geometry `.app-view-shell--chat` was removed after proving it had no runtime consumer.
- Architecture checks and regression tests were updated to require the new owners and reject reintroduction of the removed legacy ownership.

Verified before final documentation commit:
- syntax and architecture checks: green;
- full regression test suite: green;
- server build: green;
- migration/recovery jobs: green;
- staging backend: green;
- all four production domains: green;
- staging frontend: green.

## Stage 3 — remove proven dead legacy renderers

Status: IMPLEMENTED on `staging`; exact-head verification pending.

Completed after repository-wide runtime usage checks:
- physically removed `ui/shell/index.js`; no compatibility bridge remains;
- physically removed `ui/navigation/navigation.js`; the old bottom navigation is gone;
- physically removed dead `main/main.js`; live `main/people/*` and `main/finance/*` remain and are routed directly from `core.js`;
- removed legacy `.app-header` fallback selectors from `core.js`;
- moved the UI reference from old `appShell/appHeader/mediaRail` to current V2 owners;
- reduced `ui/booking/index.js` to the five runtime-used owners: `bookingThemeStyle`, `bookingChoiceCards`, `bookingDocument`, `bookingTimeGroups`, `bookingThemePreview`;
- no database/data migration was added;
- `ui/v2`, FE/Z gesture code and History behavior were not changed.

## Stage 4 — remove proven dead legacy CSS

Status: IMPLEMENTED on `staging`; exact-head verification pending.

Completed:
- physically removed `ui/shell/shell.css`;
- physically removed `ui/navigation/navigation.css`;
- moved live end-user theme/mobile styles out of the removed shell owner into `ui/booking/account-theme.css` and `ui/booking/account-mobile.css`;
- removed dead old shell/header/navigation selectors from those live style files;
- removed dead booking frame/panel/header/actions/agreement/personal-data/history presentation rules while preserving live choice/document/time/theme rules;
- removed all root HTML links to deleted styles.

## Stage 5 — permanent architecture guards

Status: IMPLEMENTED on `staging`; exact-head verification pending.

CI now prevents:
- native browser/system message UI;
- raw server error text in end-user presentation;
- duplicate/local Shared Chat, Settings, Receipt and Form owners;
- reintroduction of legacy `ui/shell`;
- reintroduction of legacy bottom navigation;
- reintroduction of the old Main hub;
- reintroduction of legacy `.app-header` compatibility selectors.

## Branch discipline

`feature -> staging -> main`.

For this emergency pre-distribution Stage 1, `staging` was reset to the current stable `main` before changes. The previous divergent staging head was preserved as `backup/staging-before-end-user-stage1-20260925`.

For every runtime cleanup stage: verify the exact `staging` head with the full CI and four-domain smoke matrix, then merge that verified head to `main`. Do not start another post-merge verification cycle.
