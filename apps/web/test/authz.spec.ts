import { canAccessTaxonomy, isPlatformAdmin } from '../src/lib/authz';
import {
  ATTRIBUTE_TYPE_LABELS,
  createAttribute,
  createCategory,
  fetchAttributes,
} from '../src/lib/taxonomy';

describe('autorización del panel de taxonomía', () => {
  it('solo el administrador de plataforma entra a /admin/taxonomia', () => {
    expect(canAccessTaxonomy('SUPER_ADMIN')).toBe(true);
    expect(canAccessTaxonomy('BUSINESS_OWNER')).toBe(false);
    expect(canAccessTaxonomy(undefined)).toBe(false);
  });

  it('reconoce el rol de plataforma', () => {
    expect(isPlatformAdmin('SUPER_ADMIN')).toBe(true);
    expect(isPlatformAdmin('BUSINESS_OWNER')).toBe(false);
  });

  it('etiqueta los tipos de atributo en español', () => {
    expect(ATTRIBUTE_TYPE_LABELS.ENUM).toBe('Lista de opciones');
    expect(ATTRIBUTE_TYPE_LABELS.TEXT).toBe('Texto');
  });
});

describe('cliente de taxonomía', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  it('crea categorías enviando solo los campos informados', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'c1', name: 'Anillos', slug: 'anillos' }),
    });

    await createCategory({ verticalId: 'v1', name: 'Anillos' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/admin/taxonomy/categories');
    expect(JSON.parse(init.body as string)).toEqual({ verticalId: 'v1', name: 'Anillos' });
  });

  it('no envía opciones cuando el atributo no es ENUM', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'a1' }) });

    await createAttribute({
      categoryId: 'c1',
      name: 'Marca',
      code: 'marca',
      type: 'TEXT',
      isRequired: false,
      isFilterable: true,
      options: ['ignorada'],
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty('options');
  });

  it('consulta los atributos de una categoría por su id', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [] }) });

    await fetchAttributes('cat-9');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/taxonomy/categories/cat-9/attributes');
  });
});
