import argon2 from 'argon2';

import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher.js';
import { hashIp, hashToken, normalizeEmail } from '../src/modules/auth/domain/session-token.js';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('genera hashes distintos para la misma contraseña (salt aleatorio)', async () => {
    const [first, second] = await Promise.all([
      hasher.hash('ClaveSegura1'),
      hasher.hash('ClaveSegura1'),
    ]);
    expect(first).not.toEqual(second);
    expect(first.startsWith('$argon2id$')).toBe(true);
  });

  it('usa los parámetros de OWASP (m=19456, t=2, p=1)', async () => {
    const hash = await hasher.hash('ClaveSegura1');
    // El hash codifica sus propios parámetros: se comprueban sin re-verificar.
    expect(hash).toContain('m=19456,t=2,p=1');
    await expect(argon2.verify(hash, 'ClaveSegura1')).resolves.toBe(true);
  });

  it('verifica correctamente y rechaza contraseñas erróneas o hashes corruptos', async () => {
    const hash = await hasher.hash('ClaveSegura1');
    await expect(hasher.verify(hash, 'ClaveSegura1')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'OtraClave1')).resolves.toBe(false);
    await expect(hasher.verify('no-es-un-hash', 'ClaveSegura1')).resolves.toBe(false);
  });
});

describe('session-token helpers', () => {
  it('normaliza el correo y hashea tokens de forma estable', () => {
    expect(normalizeEmail('  Dueno@Prenderia.COM ')).toBe('dueno@prenderia.com');
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
    expect(hashToken('abc')).toHaveLength(64);
  });

  it('nunca devuelve la IP cruda', () => {
    const ip = '190.25.10.4';
    const hashed = hashIp(ip, 'secreto');
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toContain(ip);
    expect(hashIp(ip, 'otro-secreto')).not.toBe(hashed);
    expect(hashIp(undefined, 'secreto')).toBeNull();
  });
});
