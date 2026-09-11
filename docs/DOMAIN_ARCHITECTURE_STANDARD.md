# Book domain architecture standard

This is a repository rule, not a recommendation.

## One owner, one public contract

Every complex domain lives under `core/<domain>/` and exposes exactly one public contract: `core/<domain>/index.js`.

Application manifestations (`journal/`, `timetable/`, `settings/`, `ui/`) import a domain only through that `index.js`. They must not import domain internals directly.

A manifestation is not an owner. It renders or starts a scenario. A process is not an owner either: it connects owners through their public contracts.

## Domain atoms

Create an atom only when that responsibility exists. Never create empty placeholder files merely to satisfy a shape.

When present, the canonical responsibilities are:

- `data.js` — physical persistence only. Read/write stored facts. No business calculations, no UI, no lifecycle meaning, no cross-domain orchestration.
- `read.js` — read model/projection. Reads facts and returns a consumable view. No mutation.
- `rules.js` — pure business rules/calculations. No persistence, DOM, browser events, or mutable application state.
- `service.js` — commands/actions. Orchestrates a domain action through `data/read/rules` and other domains' public `index.js` contracts.
- `events.js` — append-only domain facts when the domain has a lifecycle/event stream.
- `state.js` — projection of current state from immutable facts/events when needed.
- domain-specific atoms (`grid.js`, `availability.js`, `model.js`, etc.) are allowed only when they represent a distinct responsibility that does not fit the generic atoms.
- `index.js` — the only public entry point. No business logic should be invented here; it exports the domain contract.

## Core ownership rules

1. Storage never decides business meaning.
2. UI never calculates domain state or availability.
3. Rules never persist data.
4. Services do not render UI.
5. Read models do not mutate facts.
6. A domain imports another domain only through that domain's public `index.js`.
7. A screen/view never reaches into another domain's `data.js`, `rules.js`, `service.js`, or other internals.
8. Process/orchestration is a connection between owners, never a new owner of their data or rules.
9. Old parallel owners, compatibility wrappers, and duplicate algorithms are deleted after callers migrate. Nothing remains merely because it existed before.
10. A normal visual/product change is not permission to alter ownership boundaries.

## Current complex domains

- `core/day/` — WorkPlan/working-day facts and rules.
- `core/time/` — neutral time math, TimeGrid, occupancy contract, availability.
- `core/record/` — Record persistence, events, state/read model, commands.
- `core/finance/` — financial plan model, financial rules, money-movement persistence/read/commands.

Simple catalog entities may stay smaller. The moment a simple entity gains business rules, lifecycle, commands, or cross-domain state, it must adopt the same separation inside its own `core/<domain>/` owner.

## Manifestations

Examples:

- `journal/день.js` is the Journal Day manifestation. It does not own WorkPlan Day.
- `timetable/timetable.js` is the Timetable manifestation. It does not own TimeGrid.
- `journal/record.js` and `journal/record-view.js` are Record manifestations in Journal. They do not own Record persistence/rules/state.
- payment UI is a manifestation of Finance/Record interaction. It does not own financial calculations or money facts.

## Enforcement

`scripts/check-domain-architecture.mjs` is part of `npm run check` and rejects direct imports of internal Core domain atoms from outside their owner, legacy parallel owner files, and persistence/rule boundary violations that can be checked structurally.
