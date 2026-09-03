import { expect, it, vi } from 'vitest'
import { createShutdown } from './shutdown.js'

it('drains HTTP before disposing resources and shares the same promise for repeated signals', async () => {
  const events: string[] = []
  let finish: () => void = () => { throw new Error('close not started') }
  const dispose = vi.fn(() => { events.push('dispose'); return Promise.resolve() })
  const shutdown = createShutdown({
    close: () => new Promise<void>((resolve) => { events.push('close'); finish = resolve }),
    dispose, log: (signal) => { events.push(signal) },
  })
  const first = shutdown('SIGTERM')
  expect(shutdown('SIGINT')).toBe(first)
  expect(dispose).not.toHaveBeenCalled()
  finish()
  await first
  expect(events).toEqual(['SIGTERM', 'close', 'dispose'])
})

it('still disposes owned resources when HTTP close fails', async () => {
  const dispose = vi.fn(() => Promise.resolve())
  const shutdown = createShutdown({ close: () => Promise.reject(new Error('close failed')), dispose, log: vi.fn() })
  await expect(shutdown('SIGTERM')).rejects.toThrow('close failed')
  expect(dispose).toHaveBeenCalledOnce()
})
