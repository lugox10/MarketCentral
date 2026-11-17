/** Puerto de dominio: el algoritmo concreto es un detalle de infraestructura. */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
