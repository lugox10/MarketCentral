/**
 * Placeholder del cliente de API.
 *
 * El cliente real se genera a partir del contrato OpenAPI de `apps/api`
 * en el Prompt 04. Mientras no exista contrato, este paquete solo declara
 * la forma mínima que consumirán `apps/web` y futuros paquetes.
 */
export type ApiClient = {
  readonly baseUrl: string;
};

/** Error normalizado que devolverá el cliente generado. */
export type ApiClientError = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
};

export const API_CLIENT_PLACEHOLDER = true;
