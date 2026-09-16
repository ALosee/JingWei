# ADR 0014: Defer Outbox Activation Until a Real Consumer Exists

- Status: Accepted
- Date: 2026-09-16
- Supersedes: the speculative event-emission part of ADR 0007

## Context

The platform contains a PostgreSQL outbox schema, appender, claim repository and a single-batch
worker primitive. The running Server does not own a polling lifecycle or a concrete dispatcher.
Navigation, Dictionary, Organization and a development seed nevertheless appended events for which
no enabled module had a consumer. Those rows could only accumulate and documentation described an
operational capability that did not exist end to end.

Audit records already preserve the relevant administrative history. An Integration Event is for
actual asynchronous communication, not a speculative duplicate of every audit record.

## Decision

- Stop appending events that have no named consumer. Navigation changes, Dictionary definition
  changes, Organization membership changes and development role initialization remain transactional
  and audited, but do not write Outbox rows.
- Keep `@jingwei/outbox` and its migration as an inactive platform capability. The Server does not
  start a Worker, and operations documentation must not claim polling, delivery, heartbeat or drain
  behavior.
- Introduce an Integration Event only together with its first real consumer, versioned contract,
  idempotency strategy and end-to-end failure semantics. A no-op dispatcher must never mark events as
  published merely to empty the table.
- The first activation uses an in-process Worker owned by the Server lifecycle and explicit
  Edition-time handler composition. It must include bounded non-overlapping polling, graceful stop
  and drain, structured observability, unknown type/version handling, poison-event recovery and real
  PostgreSQL tests for claiming, stale-lock recovery, retry and transaction atomicity.
- A broker or separate Worker process still requires evidence for an independent scalability or
  failure boundary and a further ADR.

## Consequences

The current product makes no asynchronous delivery promise. Modules use synchronous Public APIs
when they need an immediate result and add no event when there is no consumer. Existing Outbox rows
are retained; they are not silently deleted, marked published or replayed. Before future activation,
deployment owners must explicitly classify any pre-activation rows.

This avoids an accumulating queue and false operational assurances while preserving a reviewed
implementation base for the first justified asynchronous integration.
