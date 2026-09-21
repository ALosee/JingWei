import { getConnInfo } from '@hono/node-server/conninfo'
import type { MiddlewareHandler } from 'hono'

import type { ServerAppEnv } from '@jingwei/module-sdk/server'

export function requestMetadata(options: {
  readonly trustProxy: boolean
}): MiddlewareHandler<ServerAppEnv> {
  return async (context, next) => {
    const userAgent = bounded(context.req.header('user-agent'), 512)
    const directAddress = directIpAddress(context)
    const forwardedAddress = firstForwardedIp(context.req.header('x-forwarded-for'))
    const ipAddress = options.trustProxy ? (forwardedAddress ?? directAddress) : directAddress
    context.set('requestMetadata', {
      ...(ipAddress === undefined ? {} : { ipAddress }),
      ...(userAgent === undefined ? {} : { userAgent }),
    })
    await next()
  }
}

export function selectClientIp(input: {
  readonly trustProxy: boolean
  readonly directAddress?: string
  readonly forwardedFor?: string
}): string | undefined {
  const directAddress = bounded(input.directAddress, 64)
  if (!input.trustProxy) return directAddress
  return firstForwardedIp(input.forwardedFor) ?? directAddress
}

function directIpAddress(
  context: Parameters<MiddlewareHandler<ServerAppEnv>>[0],
): string | undefined {
  try {
    return bounded(getConnInfo(context).remote.address, 64)
  } catch {
    // Hono's in-memory request adapter used by tests does not expose a Node socket.
    return undefined
  }
}

function firstForwardedIp(value: string | undefined): string | undefined {
  return bounded(value?.split(',', 1)[0], 64)
}

function bounded(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim()
  return normalized === undefined || normalized.length === 0
    ? undefined
    : normalized.slice(0, maxLength)
}
