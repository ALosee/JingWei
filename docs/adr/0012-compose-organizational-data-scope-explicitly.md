# ADR 0012: Compose Organizational Data Scope Explicitly

- Status: Accepted
- Date: 2026-09-16

## Context

IAM owns RBAC grants and the fixed data-scope language, including `ORGANIZATION`,
`ORGANIZATION_AND_DESCENDANTS` and organization-backed `CUSTOM`. Organization owns membership,
organization validity and tree traversal. IAM must not import Organization storage or HTTP clients,
and disabling Organization must not leave a global callback or mandatory dead port behind.

The former `supportsDataScope` boolean could not express which scope types were valid. The Web
adapter was installed through a process-global mutable loader, so module imports caused runtime
configuration and an IAM-only Edition still carried Organization-facing integration code.

## Decision

- Permission metadata declares `dataScope.allowedTypes` and an optional provider. Omission means
  `ALL` only. Organization declares the `organization` provider; Edition resolution rejects an
  enabled Permission whose provider is absent.
- IAM owns the consumer contract `OrganizationalScopeFacts`. It asks only for membership IDs,
  descendants and validation of enabled tenant-owned IDs. Organization implements the adapter.
- Edition Builder emits explicit Composition Root wiring. The full Edition creates one
  Organization facts adapter and injects it into IAM role management and Organization's
  authorization evaluator. An Edition without Organization imports and creates neither adapter.
- The Web side uses an IAM-owned UI-only `CustomScopeReferenceDirectory` injection contract.
  Generated Web composition provides Organization's adapter with Vue `app.provide`; modules do not
  mutate global loaders and `WebModule` has no startup callback.
- V1 uses central grant authority. `iam.role.manage` may read all enabled organization units in the
  current tenant through Organization's dedicated scope-options endpoint. This endpoint is not
  filtered by the administrator's own `organization.view` data scope.
- `CUSTOM` IDs are validated before a role grant is persisted and revalidated during authorization.
  Invalid, disabled, deleted or cross-tenant IDs fail closed. Historical grants are retained when
  a module is removed, but permissions absent from the current Edition are inactive.
- Authorization entry points are explicit: `requireUnscopedPermission` rejects permissions carrying
  Data Scope metadata, while `requireScopedPermission` accepts only scoped permissions and either
  returns a non-null `DataScopeGrant` or throws `PERMISSION_DENIED`. `null` never means `ALL`.
- Application translates a successful scope into module-owned query criteria. Organization pushes
  restricted tree reads into its Repository and uses a recursive query to include ancestors; the
  Repository does not depend on IAM authorization types.

## Consequences

IAM intentionally knows the organizational scope vocabulary because it owns the authorization
language, but it does not know Organization tables, routes, clients or installation state.
Organization remains responsible for the facts and UI options. A generic runtime provider registry
or Service Locator is not introduced; another independent provider requires evidence and a new ADR.
