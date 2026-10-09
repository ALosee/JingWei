# ADR 0022: Migrate the Source-owned UI to Vean

- Status: Accepted
- Date: 2026-10-08
- Extends: ADR 0010
- Supersedes: ADR 0020's mutable theme-registry integration mechanism

## Context

VeanUI 0.50.0 renames the UI packages and replaces the theme engine with explicit semantic token maps.
The engine no longer exposes a mutable custom-palette registry or the sidebar/chart scheme and surface
level options used by Jingwei's published Branding V2 contract. Replacing package names alone would
lose tenant choices and leave copied components out of sync with their aria implementation.

## Decision

Keep the source ownership and module boundaries established by ADR 0010. Pin `@vean/aria`,
`@vean/theme`, `@vean/unocss` and `@vean/cli` together, regenerate complete installed component
families, and retain concise `@jingwei/ui` exports. Architecture checks forbid both the current
`@vean/ui` styled package and its legacy name.

Branding owns a pure adapter from its persisted V2 contract to native Vean token overrides. It preserves
sidebar/chart choices, surface-level offsets, published radius lengths and light-to-dark override rules.
Server validation and browser preview consume the same adapter. Custom palettes become explicit
colors, with a controlled primary ramp passed to the styled layer for recipes using all 50–950 levels.
The UI layer owns CSS emission for this generic ramp; it contains no tenant or Branding schema.
It also preserves the V2 transparent-color contract with generic semantic alpha companions and an
UnoCSS postprocess that multiplies them by utility opacity. Native border/input/mask alpha rules stay
owned by Vean. Provider and ThemeScope reset these companions per mode, so scoped previews and
switches back to opaque colors cannot inherit stale transparency.

Remove the obsolete registry registration/temporary-slot APIs and their app lifecycle calls. Theme
option derivation and preview rendering do not mutate a shared engine registry. There is no database
migration or change to permissions, tenant isolation, stored Branding versions or user preference ownership.

## Consequences

The Provider and local ThemeScope use the same native token/CSS path. Existing custom ramps and
published choices continue to work, while component recipes can consume the full primary ramp.

Jingwei retains a small explicit theme adapter and deliberate component fixes (async buttons and
accessible attribute forwarding), which must be reviewed alongside future upstream template diffs.
The full quality gate and browser interactions verify upgrades; successful dependency installation is
not sufficient evidence of a complete migration.
