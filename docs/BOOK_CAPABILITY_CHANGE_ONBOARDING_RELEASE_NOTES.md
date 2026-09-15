# Release notes — durable capability onboarding

This change replaces browser-memory-based capability announcements with a server-persisted access-change queue.

It is additive: existing tenant/business data is not deleted or rewritten. The database migration adds one enum and one event table with foreign keys to existing SaaS access/catalog records.

The first deployment does not reconstruct historical grants that occurred before this event table existed. New grants/revocations made after deployment are tracked durably.
