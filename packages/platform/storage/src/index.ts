export interface StoredObject {
  readonly key: string
  readonly contentType: string
  readonly size: number
}

/**
 * Vendor-neutral object storage port.
 * Business modules remain responsible for authorization, tenant-safe key construction, ownership
 * metadata, retention, and validating object size/content type before calling this interface.
 */
export interface ObjectStorage {
  put(options: {
    readonly key: string
    readonly body: Uint8Array
    readonly contentType: string
  }): Promise<StoredObject>
  get(key: string): Promise<Uint8Array | null>
  delete(key: string): Promise<void>
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
}
