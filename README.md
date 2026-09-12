# Book

Production SaaS application for beauty professionals.

- `main` — production only; production releases arrive through a verified PR.
- `staging` — permanent integration/testing branch; it must never use the production database.
- `feature/*` — short-lived work branches targeting `staging`; delete after merge.
- Business data owner — server/PostgreSQL.
- Architecture: one entity / one owner / one public contract.
- Validation: `npm run check` + `npm test` + server build.

Local isolated staging: `npm run staging:up`.
It starts a separate PostgreSQL database, backend and frontend at `http://localhost:8080` with synthetic test data only.

Current project state: `docs/PROJECT_STATE.md`.
Development/release workflow: `docs/DEVELOPMENT_WORKFLOW.md`.
