# ADR 0019: Layer Tenant Presentation Defaults and User Preferences

- Status: Superseded by ADR 0020 for tenant theme expressiveness; preference layering remains accepted
- Date: 2026-09-22
- Supersedes: ADR 0016's decision that all theme and layout preferences remain separate from
  tenant Branding, and ADR 0010's assignment of complete theme persistence to `ConfigProvider`

## Context

ADR 0016 gave the Branding module ownership of tenant identity and its publication lifecycle, while
leaving the complete theme and workspace layout in browser-local state. That makes brand colors and
shell geometry vary arbitrarily between users of the same tenant, and prevents a tenant from choosing
an intentional default such as a top navigation workspace.

Not every presentation setting is brand policy. Light or dark mode and display density are personal
accessibility or comfort choices. Menu position, brand position, region dimensions and tab visibility
need a tenant default, but users still need to adapt the workspace to their tasks. Treating the saved
user value as a complete snapshot would freeze old tenant defaults indefinitely whenever any one
setting changes.

The platform control plane established by ADR 0018 is a separate trust and presentation realm. Tenant
configuration must not restyle it.

## Decision

- Branding's versioned configuration owns tenant visual theme policy: base palette, primary palette,
  component radius and sidebar color scheme.
- The same published version owns workspace defaults: left or top navigation, header or sidebar brand
  placement, header height, sidebar width and tab visibility. These fields share the existing
  draft/validate/publish/rollback lifecycle and audit boundary with the other brand fields.
- Light/dark/automatic mode and UI size remain user preferences. A user may also override each
  workspace default and the transient sidebar collapsed state.
- Browser persistence is scoped by tenant and user. Workspace overrides are sparse: the effective
  value is `platform fallback <- published tenant default <- user override`. A tenant change therefore
  reaches every field that the user has not explicitly customized. Reset removes the sparse override
  and immediately restores the current tenant defaults.
- User preferences remain browser-local in V1. They are not synchronized across devices and do not
  require a server-side settings domain. The previous unscoped local theme value is used only to
  migrate mode and size; user-selected palettes and radius do not override tenant policy.
- Branding accepts named, validated palette/radius/sidebar options only. It does not accept arbitrary
  CSS, token maps, HTML, JavaScript or external asset URLs.
- Tenant bootstrap applies theme and workspace defaults before the tenant app mounts. The platform app
  uses a distinct fixed `ConfigProvider` and never loads tenant Branding or tenant preference state.
- `@jingwei/ui` exposes a scoped theme renderer for previews. The Branding editor uses it without
  changing the live application theme while a draft is being edited.

## Consequences

A tenant administrator can publish a coherent visual identity and a useful initial workspace while
users retain ergonomic control. Publication, rollback and audit now cover presentation defaults as one
atomic snapshot. Sparse overrides add a small merge and migration model but avoid stale copied tenant
values.

Changing the active tenant or user changes the persistence namespace, preventing preference leakage
between identities in one browser. V1 intentionally has no organization-, role- or device-class layer,
no locked layout fields, no real-time publication push and no cross-device preference sync. Those
capabilities require separate evidence and contracts rather than more precedence levels in this model.
