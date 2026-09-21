# ADR 0018: Separate the Platform Control Plane by URL and Identity Realm

- Status: Accepted
- Date: 2026-09-21

## Context

ADR 0017 established a global tenant lifecycle and a CLI adapter, but normal operations need a
browser console. A platform operator is not a tenant user: it must create and suspend tenants before
or outside any tenant trust boundary. Reusing tenant IAM would either require a privileged fake tenant
or give ordinary tenant sessions cross-tenant powers.

Internal deployments commonly expose one `IP:port`, so hostname-based tenant selection cannot also
be the only way to distinguish platform operations from tenant workspaces. Deploying a separate Web
bundle for every tenant would add operational cost without improving V1 isolation, because the trusted
tenant identity still comes from the authenticated server session.

## Decision

- One Server and one Web deployment expose two URL namespaces: tenant pages keep `/` and `/signin`;
  the platform console owns `/platform/login` and `/platform/*`.
- The Web entry selects a platform or tenant bootstrap from `window.location.pathname`. Platform
  bootstrap is dynamically imported, installs only static platform routes and a fixed platform
  presentation; it does not load tenant Branding, tenant Navigation, or tenant session state.
- `@jingwei/control-plane` is an always-present platform package. It owns platform operator
  authentication, `/api/v1/platform/*`, platform tenant orchestration, browser clients and UI.
- Platform operator identity is deliberately minimal and independent of IAM. Its PostgreSQL schema,
  password credential, opaque Access/Refresh token family, Cookie names, CSRF header and
  `PlatformAuthContext` are distinct from tenant authentication.
- V1 active platform operators have the platform tenant-management authority. It is not represented
  by tenant roles or permissions. Operator invitation, platform RBAC and operator lifecycle UI require
  a later decision when multiple operational roles are real requirements.
- The first operator is created exactly once by `platform:bootstrap`; application startup never writes
  operator data. After bootstrap, routine tenant lifecycle actions use the console. The earlier tenant
  CLI remains a restricted recovery adapter to the same use cases.
- Platform actions use global `PLATFORM` audit scope. Tenant-targeting actions may record a target
  tenantId, while login, logout and bootstrap use a null tenantId. HTTP audit carries bounded
  User-Agent and a client IP derived from the direct socket unless an explicitly trusted proxy is
  configured. Successful and rejected platform logins are both append-only audit events.
- The platform and recovery CLI call one provisioning application use case. IAM and Navigation expose
  explicit platform provisioning ports accepting `PlatformAuditContext`; no tenant session or user
  actor is invented. A tenant-scoped PostgreSQL advisory lock serializes create/retry orchestration.
- Because the control plane is always present and provisions identity and navigation, Edition Builder
  requires IAM and Navigation as Foundation modules. Platform authorization metadata is restricted to
  the exact `/api/v1/platform` path segment by startup assertion and architecture checks.
- V1 tenant creation asks the authenticated operator for the initial tenant administrator password and
  passes it directly to the provisioning use case. It is never logged or audited. An expiring activation
  credential can replace this transfer when email or another verified delivery channel exists.

## Consequences

Visiting `http://<ip>:<port>/platform/login` is an explicit platform choice; visiting `/signin` is an
explicit tenant choice. No host inference or per-tenant frontend deployment is needed. Platform and
tenant sessions can coexist in one browser because their Cookie names and paths differ, though
simultaneous multi-tenant sessions remain outside V1.

Compromise of a tenant administrator does not grant platform APIs. The platform console is a higher
privilege security surface and must be protected by TLS, restricted network access where possible,
strong bootstrap credentials, audit monitoring and normal backup/restore procedures.

This ADR adds only tenant lifecycle operations. Billing, quota, custom domains, tenant impersonation,
self-registration, physical tenant deletion and a general cross-tenant data browser remain out of
scope.
