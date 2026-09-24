# ADR 0021: Avoid Unscoped Appearance Preference Migration

- Status: Accepted
- Date: 2026-09-23
- Supersedes: ADR 0019's implicit migration of mode and size from the old unscoped theme value

## Context

ADR 0019 scoped browser appearance preferences by tenant and user, but proposed reading mode and
size from the old global theme value whenever a scoped record was missing. That global value has no
tenant or user identity. In a shared browser, the first visit by a different account would therefore
copy another person's preference into its new scoped record. A later account switch could repeat the
same mistake.

## Decision

- Read appearance preferences only from the current tenant-and-user key. If no valid scoped record
  exists, use platform defaults and write those defaults under the current key.
- Do not infer ownership of the old global theme value or silently migrate it. Users can set mode and
  size again through the existing settings UI.
- Keep the separate global first-paint mode hint solely as a transient rendering hint. It is replaced
  after the active account scope is established and is never used as a preference source.

## Consequences

Changing accounts on one browser cannot import an unscoped legacy preference into another user's
record. Existing users without a scoped record may need to reselect their preferred mode and size
once. Tenant branding remains authoritative for palette and semantic colors.
