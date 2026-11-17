import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

import type { PasswordHasher } from '../domain/password-hasher.js';

/**
 * Argon2id con los par�metros m�nimos de OWASP (m=19456 KiB, t=2, p=1).
 * Se mantienen fijos para que todos los hashes sean comparables y auditables.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private static readonly OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, Argon2PasswordHasher.OPTIONS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
