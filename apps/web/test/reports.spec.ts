import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_TONES,
  archiveListing,
  fetchReports,
  formatReportDate,
  reportErrorMessage,
  reportsQuery,
  submitReport,
  suspendBusiness,
  updateReportStatus,
} from '@/lib/reports';

describe('reportes · contrato de la interfaz', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetch(payload: unknown, status = 200) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => 'application/json' },
        json: async () => payload,
      } as unknown as Response;
    }) as unknown as typeof fetch;
    return calls;
  }

  it('mantiene un motivo por cada valor del backend y etiquetas legibles', () => {
    expect(REPORT_REASONS.map((option) => option.value)).toEqual([
      'SCAM',
      'STOLEN',
      'INAPPROPRIATE',
      'WRONG_CATEGORY',
      'OTHER',
    ]);
    for (const option of REPORT_REASONS) {
      expect(REPORT_REASON_LABELS[option.value]).toBe(option.label);
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });

  it('etiqueta y colorea los cuatro estados', () => {
    expect(REPORT_STATUSES).toEqual(['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']);
    expect(REPORT_STATUS_LABELS.PENDING).toBe('Pendiente');
    expect(REPORT_STATUS_TONES.PENDING).toBe('warning');
    expect(REPORT_STATUS_TONES.DISMISSED).toBe('neutral');
  });

  it('construye la query con filtros y omite los vacíos', () => {
    expect(reportsQuery({ page: 2, limit: 10 })).toBe('page=2&limit=10');
    expect(reportsQuery({ status: 'PENDING', reason: 'SCAM', q: ' iPhone ', page: 1 })).toBe(
      'status=PENDING&reason=SCAM&q=iPhone&page=1&limit=20',
    );
  });

  it('traduce los códigos de error del backend', () => {
    expect(reportErrorMessage('DUPLICATE_REPORT', 'fallback')).toContain('Ya recibimos');
    expect(reportErrorMessage('RATE_LIMITED', 'fallback')).toContain('varios reportes');
    expect(reportErrorMessage('INVALID_TRANSITION', 'fallback')).toContain('cerrado');
    expect(reportErrorMessage('SIN_CODIGO', 'fallback')).toBe('fallback');
  });

  it('envía la denuncia con el honeypot aunque vaya vacío', async () => {
    const calls = mockFetch({ ok: true, message: 'Gracias' });
    const result = await submitReport({
      businessSlug: 'prenderia',
      listingSlug: 'iphone',
      reason: 'SCAM',
      website: '',
    });

    expect(result.ok).toBe(true);
    expect(calls[0]!.url).toContain('/public/reports');
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body).toEqual({
      businessSlug: 'prenderia',
      listingSlug: 'iphone',
      reason: 'SCAM',
      website: '',
    });
  });

  it('pide la bandeja con los filtros en la URL', async () => {
    const calls = mockFetch({ items: [], page: 1, limit: 10, total: 0, totalPages: 1 });
    await fetchReports({ status: 'PENDING', page: 1, limit: 10 });
    expect(calls[0]!.url).toContain('/admin/reports?status=PENDING&page=1&limit=10');
  });

  it('cambia el estado por PATCH y suspende o archiva por POST', async () => {
    const calls = mockFetch({ id: 'r1', status: 'RESOLVED' });
    await updateReportStatus('r1', { status: 'RESOLVED', note: 'Se corrigió la publicación.' });
    expect(calls[0]!.url).toContain('/admin/reports/r1');
    expect(calls[0]!.init?.method).toBe('PATCH');

    await suspendBusiness('b1', 'Varias denuncias sin responder.');
    expect(calls[1]!.url).toContain('/admin/businesses/b1/suspend');
    expect(calls[1]!.init?.method).toBe('POST');

    await archiveListing('l1', 'Fotos de otro vendedor.', 'r1');
    expect(calls[2]!.url).toContain('/admin/listings/l1/archive');
    expect(JSON.parse(String(calls[2]!.init?.body))).toEqual({
      reason: 'Fotos de otro vendedor.',
      reportId: 'r1',
    });
  });

  it('formatea la fecha en español de Colombia', () => {
    const formatted = formatReportDate('2026-11-19T15:30:00.000Z');
    expect(formatted).toMatch(/2026/);
    expect(formatted.length).toBeGreaterThan(10);
  });
});
