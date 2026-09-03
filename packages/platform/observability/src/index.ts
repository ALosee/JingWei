import pino, { type Logger as PinoLogger } from 'pino'

export type LogContext = Readonly<Record<string, unknown>>

/** Structured logging boundary; use fields for context and stable event-like message names. */
export interface AppLogger {
  child(context: LogContext): AppLogger
  debug(context: LogContext, message: string): void
  info(context: LogContext, message: string): void
  warn(context: LogContext, message: string): void
  error(context: LogContext, message: string): void
}

class PinoAppLogger implements AppLogger {
  constructor(private readonly logger: PinoLogger) {}

  child(context: LogContext): AppLogger {
    return new PinoAppLogger(this.logger.child(context))
  }

  debug(context: LogContext, message: string): void {
    this.logger.debug(context, message)
  }

  info(context: LogContext, message: string): void {
    this.logger.info(context, message)
  }

  warn(context: LogContext, message: string): void {
    this.logger.warn(context, message)
  }

  error(context: LogContext, message: string): void {
    this.logger.error(context, message)
  }
}

/** Creates the process logger with environment-specific level and baseline secret redaction. */
export function createLogger(options: { readonly environment: string }): AppLogger {
  return new PinoAppLogger(
    pino({
      level: options.environment === 'production' ? 'info' : 'debug',
      base: { service: 'jingwei-server' },
      redact: {
        paths: ['password', 'passwordHash', 'token', 'sessionToken', 'secret'],
        censor: '[REDACTED]',
      },
    }),
  )
}
