import { serve } from '@hono/node-server'
import { createApp } from '../app.js'
import { createRuntime } from './runtime.js'
import { createShutdown } from './shutdown.js'

/** Process lifecycle boundary. Resources are released if installation/listening fails. */
export async function startServer(): Promise<void> {
  const runtime = createRuntime()
  try {
    const app = await createApp(runtime)
    const server = await new Promise<ReturnType<typeof serve>>((resolve, reject) => {
      const instance = serve({
        fetch: app.fetch, hostname: runtime.config.http.host, port: runtime.config.http.port,
      }, () => {
        instance.removeListener('error', reject)
        resolve(instance)
      })
      instance.once('error', reject)
    })
    runtime.logger.info({
      host: runtime.config.http.host, port: runtime.config.http.port,
      edition: runtime.moduleRegistry.editionId,
    }, 'server.started')
    const shutdown = createShutdown({
      close: () => new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      }),
      dispose: () => runtime.dispose(),
      log: (signal) => runtime.logger.info({ signal }, 'server.stopping'),
    })
    const stop = (signal: string) => {
      void shutdown(signal).catch((error: unknown) => {
        runtime.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'server.shutdown_failed')
        process.exitCode = 1
      })
    }
    process.once('SIGTERM', () => stop('SIGTERM'))
    process.once('SIGINT', () => stop('SIGINT'))
  } catch (error) {
    await runtime.dispose()
    throw error
  }
}
