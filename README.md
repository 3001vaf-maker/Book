# Book

Production SaaS application for beauty professionals.

- `main` — production only.
- Business data owner — server/PostgreSQL.
- Architecture: one entity / one owner / one public contract.
- Validation: `npm run check` + `npm test` + server build.
- Development is done outside `main`; production is updated only by a verified release merge.

Current project state: `docs/PROJECT_STATE.md`.
