# ADR 0016: Own Tenant Branding in a Dedicated Module

- Status: Accepted
- Date: 2026-09-17

## Context

Jingwei currently hard-codes its product name, workspace logo, login-page wordmark and browser title
in the Web shell and IAM page. Customer deployments need a tenant-owned runtime configuration for
these values. Branding is visible during anonymous bootstrap and inside the authenticated workspace,
but proximity to Navigation or IAM does not make either module its semantic owner.

Putting branding in Navigation would couple unrelated publication histories and make non-navigation
consumers depend on menu configuration. Putting it in IAM would make identity management own visual
presentation. A generic settings table would erase field-level contracts, asset rules and lifecycle.
Edition metadata can provide a build-time fallback, but cannot replace a tenant-editable runtime
configuration.

## Decision

- Add a dedicated `branding` Foundation Module. It owns tenant brand profiles, immutable published
  versions, small validated brand assets, management permissions, audit records and its management
  page.
- Branding depends on IAM only through its public authorization API. Anonymous effective-brand reads
  use the platform `TenantDirectory`; authenticated reads always use the session tenant.
- The Web shell composes Branding with IAM and Navigation during startup. It applies the effective
  brand to document metadata, favicon and shell chrome before mounting the application.
- IAM owns a narrow Web presentation port for its login page. The application composition root
  injects Branding's current projection into that port, preventing an `iam -> branding -> iam`
  dependency cycle.
- The built-in Jingwei identity is a safe fallback. Missing or unavailable tenant branding never
  blocks authentication or Navigation recovery.
- Tenant branding and browser-local theme/layout preferences remain separate. Runtime branding does
  not permit custom HTML, CSS, JavaScript or external asset URLs.
- V1 stores bounded PNG assets and a fail-closed Logo SVG drawing subset in PostgreSQL. SVG is
  accepted only when every element, attribute, namespace and value belongs to the versioned profile;
  invalid input is rejected without storing or rewriting it. This keeps publication and references
  locally consistent without introducing an object-storage runtime. A later migration may move bytes
  behind `ObjectStorage` while Branding retains asset ownership and metadata.

## Consequences

Branding can evolve independently and serve future clients such as mobile, email or document
generation without exposing Navigation. Current Foundation Editions include it; an Edition that omits
it would also need a shell composition that does not statically consume its client. Startup gains one
failure-tolerant public read. Published brand changes take effect on the next page load; no speculative
event or Outbox entry is created until a real consumer requires delivery.

The set of Foundation Modules is no longer permanently fixed at four. New Foundation Modules still
require a cohesive domain boundary and an ADR; this decision does not authorize a generic `system` or
`settings` module.
