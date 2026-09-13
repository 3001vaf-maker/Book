# Development workflow

## Environments

### Production

`main` → GitHub Pages frontend → production Amvera API → production PostgreSQL.

Production is not a development workspace. Do not push iterative feature work, experiments, temporary files or test fixtures to `main`.

### Staging

`staging` is the permanent integration branch.

Local isolated staging is started with:

```bash
npm run staging:up
```

It creates three isolated services:

- frontend: `http://localhost:8080`;
- backend: `http://localhost:3000`;
- PostgreSQL: local Docker volume / host port `54329`.

The local frontend automatically targets the local backend. The production GitHub Pages hostname continues to target the production Amvera API.

Test login:

- email: `staging@book.local`
- password: `BookStaging-2026!`

The database is synthetic only. It is seeded once with a test profile, workplace, clients, procedures, records, wallets and one payment. Normal restarts preserve changes. To discard the staging database and recreate the fixtures:

```bash
npm run staging:reset
```

To stop staging without deleting its data:

```bash
npm run staging:down
```

## Branch flow

```text
feature/*
   ↓ PR + Check Book
staging
   ↓ user verification + Check Book
release PR
   ↓ one merge
main
   ↓
production deploy
```

Rules:

1. Start new work from current `staging`.
2. One task or coherent block = one short-lived `feature/*` branch.
3. Feature PR targets `staging`, not `main`.
4. Delete feature branch after merge.
5. Verify the completed block on staging.
6. Release is a single PR from `staging` to `main` in the chosen production window.
7. Do not point staging at production `DATABASE_URL`, production messaging credentials or production API.
8. Real email/SMS providers stay disabled until the corresponding feature is ready for production.

## Validation gate

Every feature/staging PR must pass:

- syntax and architecture checks;
- domain regression tests;
- Prisma client generation;
- server build.

Production merge happens only after the same checks pass on the exact release head.

## Main protection

`main` should be protected by a GitHub branch ruleset requiring pull requests and successful `Check Book` before merge. Repository administration is a GitHub setting, not application code; until that ruleset is enabled, the workflow above remains mandatory and no direct `main` writes are allowed.
