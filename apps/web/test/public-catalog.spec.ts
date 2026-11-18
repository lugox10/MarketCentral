import {
  businessPath,
  cityLabel,
  conditionLabel,
  fetchPublicBusiness,
  fetchPublicListingDetail,
  fetchPublicListings,
  fetchPublicVerticals,
  fetchPublicVerticalDetail,
  filtersToQuery,
  formatCop,
  listingPath,
  whatsappHref,
} from '@/lib/public-catalog';

describe('public-catalog helpers', () => {
  it('formatea precios en pesos colombianos sin decimales', () => {
    const formatted = formatCop(450_000);
    expect(formatted.replace(/\u00a0/g, ' ')).toContain('450.000');
    expect(formatted).not.toContain(',00');
  });

  it('traduce condición y ciudad, y respeta valores desconocidos', () => {
    expect(conditionLabel('LIKE_NEW')).toBe('Como nuevo');
    expect(cityLabel('ITAGUI')).toBe('Itagüí');
    expect(conditionLabel('UNKNOWN')).toBe('UNKNOWN');
    expect(cityLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  it('construye las rutas públicas canónicas', () => {
    expect(listingPath({ businessSlug: 'tecnomedellin', listingSlug: 'iphone-13' })).toBe(
      '/producto/tecnomedellin/iphone-13',
    );
    expect(businessPath('tecnomedellin')).toBe('/negocio/tecnomedellin');
  });

  it('arma el enlace de WhatsApp con el título codificado', () => {
    const href = whatsappHref('+57 300 123 4567', 'iPhone 13 "nuevo"');
    expect(href.startsWith('https://wa.me/573001234567?text=')).toBe(true);
    expect(decodeURIComponent(href.split('text=')[1] ?? '')).toContain('iPhone 13 "nuevo"');
  });

  it('serializa filtros omitiendo vacíos y devuelve cadena vacía sin filtros', () => {
    expect(filtersToQuery({})).toBe('');
    expect(filtersToQuery({ city: '', page: undefined })).toBe('');
    const query = filtersToQuery({ city: 'BELLO', minPrice: 100, page: 2 });
    const params = new URLSearchParams(query);
    expect(params.get('city')).toBe('BELLO');
    expect(params.get('minPrice')).toBe('100');
    expect(params.get('page')).toBe('2');
    expect(params.has('maxPrice')).toBe(false);
  });

  it('usa el slug de categoría como filtro indexable', () => {
    expect(filtersToQuery({ category: 'celulares' })).toBe('?category=celulares');
  });
});

describe('public-catalog fetch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('consulta el listado con la query serializada', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], page: 1, limit: 12, total: 0, totalPages: 0 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchPublicListings({ verticalSlug: 'prenderias', page: 2, limit: 12 });

    expect(result?.page).toBe(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/public/listings?');
    expect(url).toContain('verticalSlug=prenderias');
    expect(url).toContain('page=2');
  });

  it('codifica los slugs del detalle', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchPublicListingDetail('celulares antioquia', 'xiaomi/rojo');

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/public/listings/celulares%20antioquia/xiaomi%2Frojo',
    );
  });

  it('compone vertical y categorías en el detalle de la vertical', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'v1', name: 'Prenderías', slug: 'prenderias', listingCount: 3 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'c1', name: 'Celulares', slug: 'celulares', parentId: null }],
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const detail = await fetchPublicVerticalDetail('prenderias');

    expect(detail?.vertical.slug).toBe('prenderias');
    expect(detail?.categories).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/public/verticals/prenderias');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/public/verticals/prenderias/categories');
  });

  it('devuelve null si la vertical no existe aunque las categorías fallen', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) as unknown as typeof fetch;

    await expect(fetchPublicVerticalDetail('no-existe')).resolves.toBeNull();
  });

  it('pide el perfil con paginación explícita', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchPublicBusiness('tecnomedellin', 2, 24);

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/public/businesses/tecnomedellin?page=2&limit=24',
    );
  });

  it('degrada a null cuando el API responde con error', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;

    await expect(fetchPublicVerticals()).resolves.toBeNull();
  });

  it('degrada a null cuando el API no responde', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    await expect(fetchPublicVerticals()).resolves.toBeNull();
  });
});
