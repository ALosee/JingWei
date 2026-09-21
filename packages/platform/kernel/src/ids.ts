import { validate as validateUuid, v7 as uuidV7, version as uuidVersion } from 'uuid'

declare const brand: unique symbol

export type Brand<TValue, TName extends string> = TValue & {
  readonly [brand]: TName
}

export type EntityId = Brand<string, 'EntityId'>
export type TenantId = Brand<string, 'TenantId'>
export type UserId = Brand<string, 'UserId'>
export type OperatorId = Brand<string, 'OperatorId'>
export type SessionId = Brand<string, 'SessionId'>
export type RequestId = Brand<string, 'RequestId'>

function assertUuidV7(value: string, label: string): void {
  if (!validateUuid(value) || uuidVersion(value) !== 7) {
    throw new TypeError(`${label} must be a UUID v7`)
  }
}

function createId(): string {
  return uuidV7()
}

function parseId(value: string, label: string): string {
  assertUuidV7(value, label)
  return value
}

/** UUIDv7 factories. Use the narrowest entity-specific factory available. */
export const newEntityId = (): EntityId => createId() as EntityId
export const newTenantId = (): TenantId => createId() as TenantId
export const newUserId = (): UserId => createId() as UserId
export const newOperatorId = (): OperatorId => createId() as OperatorId
export const newSessionId = (): SessionId => createId() as SessionId
export const newRequestId = (): RequestId => createId() as RequestId

/**
 * UUIDv7 parsers for untrusted string boundaries. They validate at runtime before applying a brand;
 * prefer these functions to unchecked TypeScript assertions.
 */
export const toEntityId = (value: string): EntityId => parseId(value, 'EntityId') as EntityId
export const toTenantId = (value: string): TenantId => parseId(value, 'TenantId') as TenantId
export const toUserId = (value: string): UserId => parseId(value, 'UserId') as UserId
export const toOperatorId = (value: string): OperatorId =>
  parseId(value, 'OperatorId') as OperatorId
export const toSessionId = (value: string): SessionId => parseId(value, 'SessionId') as SessionId
export const toRequestId = (value: string): RequestId => parseId(value, 'RequestId') as RequestId
