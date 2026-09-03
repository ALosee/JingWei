export interface ShutdownDependencies {
  close(): Promise<void>
  dispose(): Promise<void>
  log(signal: string): void
}

/** Share one shutdown promise across signals; drain HTTP before disposing the database pool. */
export function createShutdown(dependencies: ShutdownDependencies): (signal: string) => Promise<void> {
  let pending: Promise<void> | undefined
  return (signal) => {
    pending ??= (async () => {
      dependencies.log(signal)
      try { await dependencies.close() }
      finally { await dependencies.dispose() }
    })()
    return pending
  }
}
