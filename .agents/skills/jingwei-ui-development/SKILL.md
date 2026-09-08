---
name: jingwei-ui-development
description: Build or adapt shared Vue UI components in @jingwei/ui with UnoCSS and @soybeanjs/headless. Use for design tokens, shared component APIs, SoybeanUI source adaptation, exports, and component tests. Do not use for module-owned business components or ordinary page composition.
---

# Jingwei UI Development

Build Jingwei's shared components in `packages/platform/ui`. Treat SoybeanUI as the upstream
component source, headless implementation, and theme system, while keeping Jingwei's public
component API independent.

## Read first

- Read the repository `AGENTS.md` and `packages/platform/ui/README.md` before editing.
- Read [the local SoybeanHeadless skill](../soybean-headless/SKILL.md) for primitive APIs and
  composition rules.
- When adapting an upstream styled component, read
  [the local SoybeanUI skill](../soybean-ui/SKILL.md) and only the reference for that component.
- Read `docs/references/soybean-ui.md` for the pinned upstream version and update policy.

## Ownership and public API

- Application and module code imports shared components only from `@jingwei/ui`.
- Keep direct `@soybeanjs/headless` imports inside `packages/platform/ui`.
- Reuse upstream `SConfigProvider`, `useTheme`, and `SThemeCustomizer` as theme infrastructure.
  Keep the provider name explicit; this is the exception to the component naming convention.
- Export concise component names such as `Button`, `Dialog`, and `Select`; the package name is
  already the namespace. Do not add `Jw` or preserve upstream `S` prefixes.
- Add a shared wrapper only when it owns Jingwei styling, variants, composition, or behavior.
  Do not create a component solely to rename or forward a primitive.
- Keep module-specific selectors, permission panels, and workflows in their owner modules.

## Headless and styled boundaries

- Let `@soybeanjs/headless` own ARIA semantics, keyboard interaction, focus management, and
  controlled or uncontrolled state.
- Let local components own DOM composition, public props and slots, UnoCSS classes, variants,
  and loading presentation. Use `@soybeanjs/theme` for the shared theme vocabulary.
- Prefer the upstream primitive parts when custom structure is required. Use a Compact component
  only when its data-driven structure matches the desired public API.
- Keep the headless package as a pinned dependency. Copy headless internals only for a verified
  behavior change that cannot be composed through its public API, and document the divergence.

## Source adaptation

- Import only the components required by current product work.
- Use a repository-pinned `sbean` version once the CLI is configured. Before then, copy from the
  tag and commit recorded in `docs/references/soybean-ui.md`; do not fetch mutable `main` or invoke
  an unpinned `latest` CLI.
- Review every copied file and dependency. Preserve upstream theme token semantics; remove locale,
  icon, and auto-import assumptions that Jingwei does not adopt.
- Preserve source provenance so a later upstream diff can distinguish local design decisions from
  upstream fixes.

## UnoCSS language

- Express component styling with UnoCSS utilities and statically discoverable variant recipes.
- Mount one `SConfigProvider` at the application root with `persistTheme`. Runtime theme changes
  go through its `useTheme()` context; do not create another theme store. Explicit theme props override
  stored preferences, so never pass editable defaults as permanent overrides.
- Generate the build-time fallback theme through root `sbean.json`, `presetSbean()` from
  `@soybeanjs/ui-uno`, and `@soybeanjs/theme`. Components consume Soybean semantic utilities such
  as `bg-background`, `text-foreground`, `border-border`, and `bg-primary`.
- Do not create a parallel project-prefixed theme variable layer. Customize theme seeds or use the
  Soybean theme override API when the built-in semantic vocabulary is insufficient.
- Avoid dynamically interpolated class fragments. Use complete class strings in variant maps,
  shortcuts, or an intentional safelist.
- Keep global CSS limited to reset, fonts, theme variables, shared keyframes, and behavior-critical
  rules that utilities cannot express clearly.

## Verification

- Verify semantic HTML, labels, keyboard operation, focus movement, disabled state, loading state,
  and error presentation as applicable to the component.
- Add focused component tests for behavior or contracts that can regress; do not mirror static
  class lists in tests.
- Update explicit package exports and the UI package README when the public surface changes.
- Run the repository completion commands required by `AGENTS.md` before delivery.

Verify switching, persistence, system mode changes, reset, and mobile settings in a real browser.
Build-time token generation alone does not complete the theme system.
