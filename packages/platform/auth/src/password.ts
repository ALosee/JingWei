import argon2 from 'argon2'

/**
 * Password hashing boundary. Implementations own salts and algorithm parameters; callers must not
 * compare encoded hashes or log either argument.
 */
export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(hash: string, password: string): Promise<boolean>
}

/** Argon2id implementation using the repository's reviewed baseline parameters. */
export class Argon2idPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    })
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password)
  }
}
