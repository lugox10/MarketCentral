import {
  BUSINESS_SETTABLE_STATUSES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  formatLeadDate,
  leadErrorMessage,
  leadsFilterQuery,
} from '@/lib/leads';

describe('contrato de leads', () => {
  it('etiqueta todos los estados y orígenes', () => {
    expect(LEAD_STATUS_LABELS.NEW).toBe('Nuevo');
    expect(LEAD_STATUS_LABELS.REPLIED).toBe('Respondido');
    expect(LEAD_SOURCE_LABELS.LISTING).toBe('Publicación');
    expect(LEAD_SOURCE_LABELS.BUSINESS_PROFILE).toBe('Perfil del negocio');
  });

  it('nunca permite que el negocio fije el estado NEW', () => {
    expect(BUSINESS_SETTABLE_STATUSES).not.toContain('NEW');
    expect(BUSINESS_SETTABLE_STATUSES).toEqual(['REPLIED', 'ARCHIVED', 'SPAM']);
  });

  it('construye la query con filtros, búsqueda y paginación', () => {
    expect(leadsFilterQuery({ status: 'NEW', search: ' Ana ', page: 2, limit: 10 })).toBe(
      'status=NEW&search=Ana&page=2&limit=10',
    );
    expect(leadsFilterQuery({ status: '', search: '   ', page: 1, limit: 10 })).toBe(
      'page=1&limit=10',
    );
  });

  it('traduce los códigos de error conocidos y cae al mensaje por defecto', () => {
    expect(leadErrorMessage('DUPLICATE_LEAD', 'x')).toContain('24 horas');
    expect(leadErrorMessage('RATE_LIMITED', 'x')).toContain('Demasiados mensajes');
    expect(leadErrorMessage('FORM_TOKEN_TOO_FAST', 'x')).toContain('verificando');
    expect(leadErrorMessage('INVALID_PHONE', 'x')).toContain('teléfono');
    expect(leadErrorMessage('SOMETHING_ELSE', 'mensaje de respaldo')).toBe('mensaje de respaldo');
  });

  it('formatea fechas y tolera valores inválidos', () => {
    expect(formatLeadDate('2026-11-19T14:30:00.000Z')).toMatch(/2026/);
    expect(formatLeadDate('no-es-fecha')).toBe('—');
  });
});
