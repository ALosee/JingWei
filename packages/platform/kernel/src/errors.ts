export type ErrorDetails = Readonly<Record<string, unknown>>;

/**
 * Expected application failure that can cross a protocol boundary.
 *
 * `code` is the stable machine contract; `message` and `details` must be safe to expose. Put
 * infrastructure diagnostics in `cause`, which the server logs but never serializes.
 */
export class ApplicationError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: ErrorDetails

  constructor(options: {
    readonly code: string
    readonly message: string
    readonly status?: number
    readonly details?: ErrorDetails
    readonly cause?: unknown
  }) {
    super(options.message, { cause: options.cause })
    this.name = 'ApplicationError'
    this.code = options.code
    this.status = options.status ?? 400
    if (options.details !== undefined) {
      this.details = options.details
    }
  }
}

/** Domain-rule rejection. The default HTTP projection is 422 Unprocessable Entity. */
export class DomainError extends ApplicationError {
  constructor(code: string, message: string, details?: ErrorDetails) {
    super({ code, message, status: 422, ...(details === undefined ? {} : { details }) })
    this.name = 'DomainError'
  }
}

export interface ApiErrorBody {
  readonly code: string
  readonly message: string
  readonly requestId: string
  readonly details?: ErrorDetails
}
