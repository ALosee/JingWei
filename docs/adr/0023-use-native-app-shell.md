# ADR 0023: Use Native AppShell for the Tenant Workspace

- Status: Accepted
- Date: 2026-10-10
- Extends: ADR 0010, ADR 0019 and ADR 0022

## Context

The tenant workspace assembled Layout, separate sidebar/top menus, breadcrumbs and page tabs through
an application-owned mode registry and Teleport targets. Vean AppShell already owns these aggregation
concerns and offers six menu skeletons over the same primitives. The product accepts its native
geometry and ancestor-dropdown breadcrumbs, including its full-height sidebar.

## Decision

Generate the complete AppShell and SplitNav families into source-owned `@jingwei/ui`. Preserve native
paths and internal names, and export concise names and explicit consumer types. Do not add `@vean/ui`.
Keep native layout skeletons and breadcrumb rendering; do not preserve the previous full-width header.

Web owns adaptation from the authorized Navigation projection. Preserve PAGE nodes with `hidden: true`
and bind the current route's navigation code, so native breadcrumb lookup can include hidden pages
while menu and ancestor dropdown rendering exclude them. Independently authorized orphan PAGE nodes
stay hidden roots; never reconstruct unauthorized ancestors. Supply visible ancestor expansion through
TreeMenu's controlled API on PAGE routes, because its menu projection filters hidden entries.

Retain generic link destinations when projecting ancestor dropdown options. This local upstream fix
lets dropdowns use the same RouterLink and safe external-Link behavior as menus, without a second
navigation handler. Keep typing adaptations localized to the generated styled layer.

Web owns concrete tab locations, collection lifecycle and the final-tab close rule. AppShell renders
the collection. Preserve query/hash on tab return; hiding the tab strip does not clear the collection.
Keep the existing cache boundary: no KeepAlive, restored tab session or cross-window synchronization.

Branding owns all six workspace mode defaults. Preserve historical `left` and map it to native
`sidebar`; keep `top` and add the four native split modes. Expand the module-owned database column and
CHECK through a forward migration, regenerate the OpenAPI contract, and preserve immutable snapshots.
Apply the existing platform fallback, tenant defaults and scoped sparse user overrides.

Use configured widths only for the single-sidebar mode; split modes derive widths from native pane
geometry. Pass the three native sidebar variants (`sidebar`, `floating`, `inset`) through tenant defaults,
sparse personal preferences and draft preview. Default the platform brand to `sidebar`; retain the
historical contract alias `sider` and map `sider-bottom` to native `sidebar-bottom`. Top placement is
available on sidebar-bearing skeletons; bottom placement requires the stable columns in sidebar or
dual-vertical mode. Disable unavailable choices and let the native resolver handle fallback while
preserving the stored preference. Extend the Branding schema and CHECK constraints through a forward
migration; existing snapshots retain their brand placement and receive the standard sidebar variant.
Mobile always uses the native
full-tree drawer with temporary `mobileOpen`, independent of the persisted desktop collapsed state.
Keep `base`/`blank` route layouts and the separate platform control-plane shell unchanged.

## Consequences

The application no longer owns a menu mode-component registry or menu Teleport targets. It retains
small navigation and tab controllers plus brand/toolbar composition. Source updates must retain the
link projection fix and existing TreeNav accessibility fixes. Native mode, hidden-page breadcrumb,
ancestor-link navigation, preferences, page tabs and mobile drawer interactions require browser tests.

Branding previews render the same native shell on a fitted desktop canvas with an isolated named-group
style scope. Generate its classes from native recipes at build time. This prevents the surrounding
workspace's collapsed/mobile/hidden-sidebar flags from affecting preview geometry while retaining
native menu Teleports and theme scopes. Brand marks use full-width flex rows rather than padded,
fixed-size collapsed menu icon cells; this is a styled sizing fix, with no shell-mode behavior change.
