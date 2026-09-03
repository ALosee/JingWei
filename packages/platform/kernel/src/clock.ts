/** Injectable source of business time; use a fixed implementation in deterministic tests. */
export interface Clock {
  now(): Date
}

/** Production wall-clock implementation. Domain/application code should depend on `Clock`. */
export const systemClock: Clock = {
  now: () => new Date(),
}
