# CLEANUP_STATUS

- 0 baseline main/staging: DONE
- 1 UI alphabet: DONE
- 2 gesture/movement map: DONE
- 3 split ui/v2 internals without changing public API: TODO
- 4 single gesture owner: IN_PROGRESS
- 5 F/E/Z/rail scroll ownership: IN_PROGRESS
- 6 CSS ownership: IN_PROGRESS
- 7 runtime bridges / legacy / migration cleanup: DONE
- 8 contour-by-contour runtime audit: TODO
- 9 physical browser/FEZ/smoke verification: IN_PROGRESS
- 10 permanent CI/project guards: IN_PROGRESS

Order is fixed. Do not renumber or replace these stages with subtask counts.

## Verification checkpoint 2026-10-04

- Reviewed baseline: staging `91dec6b1c0ca19818bb1b591a6348e0e839fd396`; main unchanged.
- Baseline architecture check passed; 73/76 unit/contract files passed. Three tests still required retired modal variants or the retired 88px payment sheet. Updated assertions to the existing Q/X/S contract and shared payment Z flow; no runtime rollback.
- Shared X/S swipe strip was 30px, while content insets were 18–24px. Reserve its size in Shared modal padding; no feature-specific CSS or gesture handler added.
- Local `npm run check` and `npm test` pass after the change. Browser proof must come from the new `modal-browser-interaction` CI job; the local environment has no installed browser and blocks browser downloads.
- The browser job checks actual hit targets and trusted mouse/touch input, includes an old-padding negative control, and verifies service workplace selection through the shared menu. It is not a physical iPhone test or a complete audit of the 134 earlier staging commits.
- Do not mark full cleanup complete or merge the accumulated staging changes based only on this checkpoint. The reported iPhone failure and slow startup still require verification in the actual application.
