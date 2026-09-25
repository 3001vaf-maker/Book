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

Status: IN PROGRESS on `staging`.

Move reusable local form/error/chat/settings/receipt presentation from end-user files into canonical Shared UI owners. Preserve behavior and visual output.

Substages:
- 2A Chat: move message bubble/thread/composer code and styles from legacy `ui/shell` into canonical `ui/chat`; no visual or behavioral change.
- 2B Settings/receipt: move active settings/toggle/read-only receipt owners out of legacy shell.
- 2C Forms/errors: move reusable local end-user form/error presentation into Shared UI without changing flows.

## Stage 3 — remove proven dead legacy renderers

Status: NOT STARTED.

After repository-wide usage checks, remove unused old shell/header/bottom-navigation/booking renderers. Never delete an owner while any active contour still imports it.

## Stage 4 — remove proven dead legacy CSS

Status: NOT STARTED.

Only after Stage 3 and usage verification, remove legacy CSS no longer referenced. Re-run visual and interaction checks after each removal group.

## Stage 5 — permanent architecture guards

Status: NOT STARTED.

Add CI rules preventing:
- native browser/system message UI;
- raw server error text in end-user presentation;
- new local copies of Shared UI;
- reintroduction of dead legacy owners into the end-user contour.

## Branch discipline

`feature -> staging -> main`.

For this emergency pre-distribution Stage 1, `staging` was reset to the current stable `main` before changes. The previous divergent staging head was preserved as `backup/staging-before-end-user-stage1-20260925`.

Do not merge Stage 1 to `main` until the required CI and four-domain verification is complete.
