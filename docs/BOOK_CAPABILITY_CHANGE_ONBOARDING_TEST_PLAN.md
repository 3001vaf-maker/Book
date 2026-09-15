# Manual test plan

1. Master is logged in and working in Book.
2. Admin grants one disabled section and saves.
3. Master clicks any normal control without reloading the page.
4. Blocking general modal must appear.
5. Confirm it; new section must be visible.
6. Click that new section for the first time.
7. Blocking section-specific modal must appear before the section action proceeds.
8. Confirm it; section opens.
9. Leave/re-enter Book; the same intro must not repeat.
10. Admin grants two sections in one save; one general modal must appear, then each section intro only on first click.
11. Admin revokes one section; on next master activity it must disappear without page reload and a blocking revocation message must appear.
12. Close browser before acknowledging a newly granted section; on a later login the pending message must still appear.
