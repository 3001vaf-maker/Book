# Document architecture

## 1. Invariants

Canonical storage owners remain `PlatformDocumentArchive` for platform registry data and `TenantDocumentArchive` for one profile's document domain.

A common visual cover does not make all documents one business entity.

The tenant document domain has three explicit lifecycle classes:

| Class | Meaning | Delete | Version chain | Signing events |
| --- | --- | --- | --- | --- |
| `CORE_LEGAL` | Three platform-backed legal/current documents | No | Yes | When the document is signable |
| `USER_DOCUMENT` | A document created or uploaded by the profile for its own work | Yes | Yes | Only when explicitly signable |
| `FILE` | An ordinary file or helper PDF | Yes | No | Never |

The UI must never infer lifecycle rules from card appearance, title, file extension, color or screen location. Lifecycle is explicit.

## 2. Platform registry

The platform registry owns source material, not tenant document instances.

It contains three legal templates used to build the profile's three core documents:

1. `user-document-pdn-policy` → `pdn-agreement`
2. `user-document-pdn-consent` → `pdn-consent`
3. `user-document-messages-consent` → `messages-consent`

Only these three sources appear in **A → Шаблоны** for the profile.

The registry separately contains helper-generator templates, currently `rkn-notification-guide-template`. A helper-generator template is not a tenant legal template and never appears in the profile's **Шаблоны** list.

## 3. Tenant documents

`TenantDocumentArchive.documents` owns current tenant artifacts.

The three core legal documents always have stable logical IDs and class `CORE_LEGAL`. Editing a template updates the matching tenant document; it does not create another current document.

Example:

```text
pdn-consent
  current version: 4
  archived snapshots: v1, v2, v3
```

The profile still has one current `pdn-consent`, not four visible copies.

A profile-created contract is `USER_DOCUMENT`. It may be removed from current documents. If it was signed, immutable snapshots and signing events remain available for the signing facts.

An ordinary uploaded PDF is `FILE` unless the profile explicitly marks it for signing, in which case it becomes `USER_DOCUMENT`.

## 4. RKN helper

The RKN PDF is a `FILE`.

It is:
- generated from a helper template and factual profile data;
- a finished system PDF that may be hidden from one profile's visible Documents;
- not signable;
- not a legal consent document;
- not versioned;
- never written to tenant document history;
- never written to `TenantConsentEvent`;
- never shown in signing history.

If relevant profile facts later change, a new **separate** update-helper PDF may be generated. The earlier PDF remains a separate system artifact.

A platform helper-template update by itself does not create another tenant PDF when the profile facts have not changed.

For an RKN helper, the user-facing remove action means **hide from this profile's visible Documents**, not physical deletion. The artifact and generator state remain stored. A hidden helper must not reappear on login or refresh. A new helper may be generated only when relevant factual profile data changes.

## 5. Document versions

Document version snapshots exist only for `CORE_LEGAL` and `USER_DOCUMENT`.

They are technical/audit backing data. They are not a second user-facing list and they are not the visible **История** tab.

A previous snapshot is used to open the exact content that was signed after the current document has changed or has been removed from current documents.

## 6. Signing events

`TenantConsentEvent` is the only source of the tenant's visible signing history.

Each event records:
- subject;
- document ID;
- exact document version;
- accepted / revoked / declined;
- exact time;
- source/channel.

A `FILE` is rejected by the signing service even if a caller submits its ID directly.

The visible **История** tab is built only from these events. Technical version creation, renames, helper generation and file uploads are not displayed there.

## 7. PDN consent grey zone

For the current `pdn-consent`, revocation does not delete the account, client data, booking/request history, notifications or consent history.

When the current PDN consent is absent or revoked:
- login remains available;
- consent documents and consent management remain available;
- booking/request history created before revocation remains readable;
- notifications created before revocation remain readable and may be marked read;
- creating a new booking/request is blocked;
- Chat is unavailable until the current PDN consent is accepted again;
- new direct/service/marketing delivery follows the existing consent guards.

Data deletion/anonymisation is a separate process and is not triggered by consent revocation.

## 8. Profile Documents UI

Z1 has one switch: **Документы | История**.

### Документы

The first section is **Основные документы** and shows the three `CORE_LEGAL` documents in one horizontal rail.

The second section is **Другие документы** and shows:
- RKN helper PDFs;
- uploaded ordinary PDFs;
- profile-created documents.

Both **Основные документы** and **Другие документы** use horizontal rails.

All use the same shared `documentTile()` cover. Shared cover means shared geometry only; lifecycle rules come from document class. The shared cover is fixed at 238 px, uses the soft file/document silhouette with a folded corner, keeps the title to a compact two-line composition without ellipsis, and represents signed state with a single check indicator rather than duplicating status text.

Clicking a cover opens Z2 **Информация о документе**. Z2 contains:
1. the same document cover;
2. factual document information;
3. A = document settings.

Clicking the cover inside Z2 opens the actual content in the shared technical viewer: black background, white paper, close only.

For `CORE_LEGAL`, settings do not offer deletion. For `USER_DOCUMENT` and `FILE`, deletion is allowed. Additional settings can be added later without changing lifecycle ownership.

### История

History contains signing events only. The same document may appear many times because different people can sign the same version or different versions.

Opening an event shows a small top informational modal only. It contains, linearly: document title, exact version, person, date-time and action status. It has no buttons, no repeated document cover, no receipt UI, no technical source and no document-opening action. The immutable signed snapshot remains audit backing data for later evidence/export flows.

## 9. End-user boundary

End-user consent screens receive projections only for tenant documents that actually participate in consent/signing.

Helper files and ordinary files never participate.

The end user does not own document versions or signing history. End-user actions write immutable `TenantConsentEvent` facts in the tenant document domain.

## 10. Ownership chain

```text
Platform Registry
  ├─ legal templates (3)
  │    ↓ materialize/update
  │  Tenant CORE_LEGAL documents (3 current logical documents)
  │    ├─ hidden version snapshots
  │    └─ TenantConsentEvent signing facts
  │          ↓ projection
  │       profile History / person context / end-user consent state
  │
  └─ helper templates
       ↓ generate
     Tenant FILE (for example RKN PDF)
       └─ no versions / no signing history

Profile-created content
  ├─ USER_DOCUMENT → optional signing + hidden versions
  └─ FILE → deletable, no versions, no signing history
```

No UI layer may collapse these owners into one lifecycle.
