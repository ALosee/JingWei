# ADR 0017: Own Tenant Lifecycle in Platform Tenancy

- Status: Accepted
- Date: 2026-09-20

## Context

Jingwei already scopes users, roles, organization, navigation, dictionary and branding by tenant, but the platform tenant table only supported an active-code lookup and development seed. There was no production provisioning workflow, lifecycle state machine, whole-tenant session revocation or control-plane actor audit.

A normal tenant administrator cannot safely create, list or suspend other tenants. Existing `AuthContext` always contains one tenant user, while platform operations occur before or outside that trust boundary. Modeling an operator as a user in a privileged “platform tenant” would reintroduce cross-tenant access through ordinary IAM and contradict the authorization baseline.

Tenant identity is also required before IAM can authenticate a user and before Edition modules can be installed. Making it an ordinary tenant-scoped Foundation Module would create an awkward IAM dependency cycle and make an essential registry Edition-optional.

## Decision

- `@jingwei/tenancy` is an always-present platform package, analogous to auth and audit. It owns the runtime semantics and new migrations of `platform.tenant`; the original foundation migration remains immutable history.
- Tenant status is `PROVISIONING | ACTIVE | SUSPENDED | DISABLED`. Only ACTIVE tenants may authenticate or refresh sessions. DISABLED is a non-deleting terminal state.
- Tenant code is normalized, globally unique and immutable. Edition, Module and Capability selection remain build-time product concerns and are never tenant columns.
- The public runtime directory remains deliberately narrow: active lookup by code and active-state verification by trusted TenantId. Business modules cannot enumerate tenants.
- Access and Refresh authentication call the active-tenant gate. Suspension and disable additionally revoke every existing tenant session.
- Production provisioning is an idempotent application workflow: reserve a PROVISIONING tenant, initialize IAM, publish default Navigation, grant the initial administrator, then activate. A failed step records a safe error code and remains retryable; it never exposes a partially initialized tenant as ACTIVE.
- Provisioning composes synchronous Public APIs because the current monolith has no enabled worker or real asynchronous consumer. No speculative Integration Event or Outbox record is created.
- Platform actions use `PlatformAuditContext` with a CLI, platform-operator or system actor. They never invent a tenant `UserId`.
- The first adapter is a production CLI protected by deployment/database access. ADR 0018 adds an Operator Console that reuses the same use cases, maintains its own operator authentication realm and stays outside tenant Navigation.
- On a shared IP and port, an anonymous request without tenant information uses the platform fallback. Tenant code selects the pre-login brand; after authentication, Session tenantId is authoritative. Simultaneous sessions for multiple tenants in one browser are not a V1 requirement.

## Consequences

Every deployment still creates at least one real tenant and retains tenant_id isolation; there is no single-tenant bypass. A suspended tenant fails closed even if session revocation is delayed or fails. Production onboarding no longer uses development seed SQL.

The initial CLI accepts the initial administrator password only through an injected Secret/environment value and never logs or audits it. A future Operator Console should replace this bootstrap transfer with a hashed, expiring, single-use activation credential.

Platform audit now distinguishes tenant-user and control-plane actors. The operator UI and independent authentication realm are decided separately in ADR 0018; custom/internal domains, billing, quota, self-registration, tenant switching and physical decommission remain outside this decision.
