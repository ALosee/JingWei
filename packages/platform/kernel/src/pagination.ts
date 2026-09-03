/** One-based page request; protocol boundaries must validate positive, bounded values. */
export interface PageRequest {
  readonly page: number
  readonly pageSize: number
}

/** Immutable page result where `total` counts all matching rows, not only this page. */
export interface PageResult<TItem> extends PageRequest {
  readonly items: readonly TItem[]
  readonly total: number
}
