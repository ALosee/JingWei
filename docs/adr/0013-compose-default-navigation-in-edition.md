# ADR 0013: Compose Default Navigation in the Edition

- Status: Accepted
- Date: 2026-09-16

## Context

Navigation previously enumerated every Edition route and guessed a menu name, path, icon and
placement. It also hard-coded route keys owned by IAM, Organization and Dictionary. New modules
therefore either received poor defaults or required edits inside Navigation. Hidden pages and routes
behind disabled capabilities could also be incorrectly materialized as menus.

Route availability and safety are not the same concept as tenant navigation. A route must not become
a menu merely because it exists.

## Decision

- Route Definitions continue to own stable route identity, page binding and security constraints.
- A module may separately publish pure `navigationItems` metadata as an initialization suggestion.
  It explicitly chooses MENU versus PAGE, name, path, icon, parent code, order, layout and access
  mode; no values are inferred from the route key.
- The Edition owns shared containers plus `authEntryCode` and `homeCode`. Edition resolution combines
  enabled module items, filters routes whose required capability is disabled, and validates codes,
  parent references and entry points.
- Navigation reads only the resolved Edition preset when an operator explicitly creates the first
  draft. It materializes snapshot-local UUIDs, then applies its normal full validation.
- Existing published tenant versions are never rewritten. Routes without an explicit navigation
  item remain available in the catalog for manual tenant configuration but are not automatically
  inserted into a menu.

## Consequences

Adding a module may require declaring its own suggested items and choosing their Edition placement,
which is intentional product composition. It never requires adding that module's vocabulary to the
Navigation implementation. Edition generation remains static and disabled module items do not enter
the initial template.
