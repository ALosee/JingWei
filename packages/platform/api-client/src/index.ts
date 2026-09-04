import type { z } from 'zod'

/** Stable client-side representation of a non-success Jingwei API response. */
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId: string | null,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

/**
 * Performs a credentialed JSON request and validates a successful body at runtime.
 *
 * Unlike a generic cast around `fetch`, the returned type is inferred from the supplied Zod schema.
 * This helper currently expects a JSON body for success and failure; use a dedicated client for
 * `204 No Content`, streams, or file downloads.
 *
 * @throws {ApiClientError} For non-success HTTP responses.
 * @throws {z.ZodError} When a successful response violates `schema`.
 */
export async function requestJson<TSchema extends z.ZodType>(options: {
  readonly input: RequestInfo | URL
  readonly init?: RequestInit
  readonly schema: TSchema
}): Promise<z.infer<TSchema>> {
  const headers = new Headers(options.init?.headers)
  if (!headers.has('accept')) headers.set('accept', 'application/json')

  const response = await fetch(options.input, {
    credentials: 'include',
    ...options.init,
    headers,
  })
  const body: unknown = await response.json()

  if (!response.ok) {
    const error = parseError(body)
    throw new ApiClientError(
      error.code,
      error.message,
      error.requestId,
      response.status,
      error.details,
    )
  }

  return options.schema.parse(body)
}

function parseError(value: unknown): {
  readonly code: string
  readonly message: string
  readonly requestId: string | null
  readonly details?: unknown
} {
  if (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  ) {
    return {
      code: value.code,
      message: value.message,
      ...('details' in value ? { details: value.details } : {}),
      requestId:
        'requestId' in value && typeof value.requestId === 'string' ? value.requestId : null,
    }
  }
  return { code: 'UNEXPECTED_RESPONSE', message: 'Unexpected API response', requestId: null }
}
