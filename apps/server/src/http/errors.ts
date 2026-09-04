import type { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { ApplicationError, type ApiErrorBody } from '@jingwei/kernel'
import type { ServerAppEnv } from '@jingwei/module-sdk/server'
import type { AppLogger } from '@jingwei/observability'

/** Owns HTTP error translation; application/domain errors never decide response serialization. */
export function installHttpErrors(app: Hono<ServerAppEnv>, logger: AppLogger): void {
  app.notFound((context) =>
    context.json(
      {
        code: 'ROUTE_NOT_FOUND',
        message: '请求的 API 不存在',
        requestId: context.get('requestId'),
      } satisfies ApiErrorBody,
      404,
    ),
  )

  app.onError((error, context) => {
    const applicationError =
      error instanceof ApplicationError
        ? error
        : // Hono parses JSON before Zod's hook. Normalize parser failures without exposing its message.
          error instanceof HTTPException && error.status === 400
          ? new ApplicationError({
              code: 'INVALID_REQUEST',
              message: '请求格式不正确',
              status: 400,
            })
          : new ApplicationError({
              code: 'INTERNAL_ERROR',
              message: '服务器内部错误',
              status: 500,
              cause: error,
            })
    logger.error(
      {
        requestId: context.get('requestId'),
        code: applicationError.code,
        error: error instanceof Error ? error.message : String(error),
      },
      'http.error',
    )

    const body: ApiErrorBody = {
      code: applicationError.code,
      message: applicationError.message,
      requestId: context.get('requestId'),
      ...(applicationError.details === undefined ? {} : { details: applicationError.details }),
    }
    return context.json(body, normalizeStatus(applicationError.status))
  })
}

function normalizeStatus(status: number): 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503 {
  switch (status) {
    case 400:
    case 401:
    case 403:
    case 404:
    case 409:
    case 422:
    case 500:
    case 503:
      return status
    default:
      return 500
  }
}
