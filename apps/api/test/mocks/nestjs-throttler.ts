/**
 * Sustituto de `@nestjs/throttler` solo para Jest.
 *
 * Motivo: la versión 6.7.1 se publica como CommonJS y, al requerirse desde el
 * grafo ESM de Nest 12 dentro de Jest, produce
 * `Cannot require() ES Module ... in a cycle`. En ejecución real (Node ESM)
 * el paquete funciona con normalidad; aquí basta con que el guard deje pasar
 * para probar los flujos de autenticación. El límite real se verifica con una
 * prueba HTTP contra la API levantada (ver docs/22, E1-H5).
 */
import { Module } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

/** `ThrottlerModule.forRoot()` real solo registra opciones y storage; aquí sobra con un módulo vacío. */
@Module({})
export class ThrottlerModule {
  static forRoot(): typeof ThrottlerModule {
    return ThrottlerModule;
  }
}

export class ThrottlerGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

export function Throttle(): MethodDecorator & ClassDecorator {
  return () => undefined;
}
