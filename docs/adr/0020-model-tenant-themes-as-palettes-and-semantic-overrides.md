# ADR 0020: Model Tenant Themes as Palettes and Semantic Overrides

- Status: Accepted
- Date: 2026-09-22
- Supersedes: ADR 0019's restriction to named palette options without token maps

## Context

Named primary/base palettes, radius and sidebar schemes are safe but cannot represent real tenant
identities. A customer may require a warmer page background, a darker card surface, a distinct
popover, a branded focus ring, or a deliberately tuned dark mode. Treating all of those as a single
primary color forces customer-specific CSS or product code branches, which is less safe and less
maintainable than a versioned theme contract.

At the same time, accepting raw CSS or an unrestricted token object would expose implementation
details, weaken validation and make future theme-engine migrations difficult. Tenant policy must also
remain separate from a user's light/dark and density preferences.

## Decision

- Branding owns a versioned tenant theme contract with two layers:
  - a foundation layer containing a complete 50–950 neutral ramp, a complete 50–950 brand ramp,
    radius, sidebar/status/chart schemes, light/dark surface depth and border opacity;
  - sparse light/dark semantic overrides for a fixed allowlist of surface, text, interaction, sidebar,
    feedback and chart roles.
- Each palette may use a built-in named ramp or a persisted custom `OKLCH_PALETTE_V1` definition. A
  custom definition stores its seed plus normalized HSL and OKLCH values for every required level.
- Semantic values are a discriminated contract: a palette-level reference, one of three safe simple
  colors, or a validated HSL/OKLCH literal. Selectors, CSS declarations, variables, URLs, HTML and
  scripts are never accepted.
- Overrides stay sparse. The runtime derives the normal theme first, then applies tenant overrides.
  Resetting a role removes the override so future engine improvements remain visible.
- Structural validation occurs at the HTTP and persistence boundaries. Publication additionally
  checks custom-ramp ordering and the effective contrast of affected surface/foreground pairs,
  including a one-sided override against its inherited counterpart.
- Custom palettes are registered with the theme engine under content-addressed runtime keys. The
  published contract remains engine-independent, and preview/runtime use the same adapter.
- The editor is controlled by the Branding draft. It does not read or write theme localStorage.
  Light/dark preview is local to `ThemeScope`; it cannot restyle the management application.
- The editor distinguishes palette family, semantic level, literal color and complete-ramp tuning.
  A shade click selects a value for the current role, not a new ramp seed. Tuning begins from an
  exact copy of the active preset, and rebuilding all shades from a seed requires explicit action.
- User mode and density remain tenant+user preferences. Platform administration continues to use a
  fixed platform theme and never consumes tenant theme configuration.

## Consequences

Tenants can tune both palette depth and concrete surfaces without customer-specific code, while the
platform retains a finite, validated and migratable contract. The version row gains JSONB only for the
parts whose shape is intentionally dynamic and versioned: two optional color ramps and sparse semantic
overrides. Stable selectors such as radius, schemes and level offsets remain ordinary constrained
columns.

The editor and contract are larger than named selects, and publication can reject visually unsafe
combinations. This cost is preferable to hidden CSS escape hatches. V1 does not include gradients,
typography, spacing, shadows, arbitrary component-level styling, uploaded theme packages or per-page
themes; those require distinct semantic contracts and evidence.
