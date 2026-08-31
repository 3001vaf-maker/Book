# ARCHITECTURE DICTIONARY — Book

## Purpose

Single architectural dictionary for the Book application.

The dictionary describes the stable architecture and shared system vocabulary. It does not replace individual TЗ documents.

## Core architectural rule

Book is one application with one shared Core, one shared UI system, and one shared CSS system.

New features and entities extend the existing architecture. They do not create parallel application roots or local copies of shared systems.

## Shared UI vocabulary

### Entity Card

`Entity Card` is the shared card component used to visually represent entities throughout Book.

It is a common UI component and does not belong to any individual entity.

Entity-specific content is supplied by the entity; the card implementation remains common.

Any entity that requires a card must use the existing `Entity Card` rather than creating a local card implementation.

### Other shared UI

Lists, list rows, modals, fields, buttons, selectors, duration pickers, workplace selectors, toggles and other reusable interface elements belong to the shared UI/Core system when their behavior or structure is common across the application.

## CSS

Book uses one shared CSS system.

Entity-specific implementations must not create parallel CSS systems or duplicate existing visual rules.

## Entity model

Business entities receive stable E-identifiers in the entity registry.

E-identifiers are assigned when an entity is actually defined. Numbers are not reserved in advance.

## Current entities

- E-01 — Client / Человек-профиль клиента
- E-02 — Profile / Профиль мастера
- E-03 — Workplace / Место работы
- E-04 — Procedure / Процедура
- E-05 — Product / Товар

## Architectural ownership

Entities live inside their existing application branches. A branch/folder is not automatically a business entity.

For example:

```text
Настройки
└── Сервис
    ├── Процедуры       → E-04 Procedure
    └── Товары          → E-05 Product
```

## Profile and Workplace

Profile is E-02.

Workplace is E-03 and may have multiple records associated with one Profile.

Personal and professional data remain sections of Profile rather than separate business entities.

## General extension rule

When a new entity needs functionality that is reusable elsewhere, that functionality belongs in the shared Core/UI system rather than inside the new entity.

A visually similar component with materially different behavior may be a separate component, but this decision must be based on behavior and architecture, not merely appearance.
