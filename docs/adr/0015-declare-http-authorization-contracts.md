# ADR 0015: Declare HTTP Authorization Contracts

- Status: Accepted
- Date: 2026-09-17

## Context

Functional authorization is correctly enforced in Application use cases, so HTTP is not the only
protected caller. However, OpenAPI previously described only authentication and CSRF security.
Permission names appeared in response descriptions, and no executable rule guaranteed that every
new endpoint was explicitly classified. Module route definitions describe Web pages and therefore
cannot serve as HTTP authorization metadata.

The current RBAC model and permission granularity are sufficient for the platform-foundation stage.
This decision does not introduce Casbin, endpoint-shaped permission codes, a permission cache, role
inheritance, direct user grants or explicit deny.

## Decision

- Every module OpenAPI operation is created with `createApiRoute` and declares exactly one access
  contract: `PUBLIC`, `AUTHENTICATED`, `REFRESH_TOKEN` or `PERMISSION`.
- A `PERMISSION` contract lists every required permission, its capability and whether it uses the
  scoped or unscoped evaluator. Multiple requirements mean logical AND; role navigation grant writes
  therefore declare both `navigation.manage` and `iam.role.manage`.
- Permission metadata is defined once as an immutable owner-module requirement object. Application
  authorization and the OpenAPI contract consume that same object; cross-module requirements are
  imported only from the owner module's public API. This removes duplicated permission strings from
  the two enforcement descriptions.
- The contract is emitted as the OpenAPI `x-jingwei-authorization` extension. It documents the real
  Application requirement; it does not move enforcement into HTTP middleware.
- Server composition validates all enabled `/api/v1` operation contracts against the resolved
  `ModuleRegistry` before the app is returned. Missing permissions, disabled capabilities,
  cross-owner permission/capability pairs and scope-mode mismatches fail startup. This is a
  structural/Manifest check; it does not inspect arbitrary Application control flow.
- `architecture:check` rejects direct `createRoute` use in module `server/api/openapi.ts` files.
  Contract tests also verify that metadata survives OpenAPI generation.
- Permission checks continue to query PostgreSQL live. Unscoped authorization and effective
  permission reads use a single tenant-scoped join instead of loading role IDs first; scoped
  authorization loads active grants in one join plus the optional CUSTOM organization query.
- Authorization evaluation emits structured debug timing with permission, evaluator kind, outcome
  and request context. Slow or failed evaluation is logged at warning level. No role list, policy
  cache, password or credential value is logged.
- Invalid persisted CUSTOM references still fail closed as `PERMISSION_DENIED`. Infrastructure
  failures are no longer collapsed into 403; they keep the normal internal-error path so operations
  can distinguish an outage from a real denial.

## Consequences

The API catalog can now answer which endpoints are public, self-service or permission-protected,
and CI/startup detect drift without relying on prose review. Application remains the security
boundary, preserving protection for future non-HTTP callers.

Adding an endpoint requires an explicit contract even when it only needs authentication. Adding a
new permission still requires the owner module Manifest, Application enforcement, role-management
projection and tests. Permission metadata is shared instead of copied, while endpoint-to-use-case
mapping remains an explicit, reviewable API responsibility. Contract tests traverse every business
operation and retain representative exact assertions for each access kind and multi-permission AND.
