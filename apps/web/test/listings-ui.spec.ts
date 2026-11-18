import {
  LISTING_CONDITION_LABELS,
  LISTING_STATUS_LABELS,
  STATUS_TONES,
  attributesSummary,
  formatPrice,
  isPublishable,
  listingStateHint,
  uploadListingImage,
  type AttributeDefinition,
} from '../src/lib/listings';

const definitions: AttributeDefinition[] = [
  { id: 'd1', code: 'marca', name: 'Marca', type: 'TEXT', isRequired: true, isFilterable: true },
  {
    id: 'd2',
    code: 'almacenamiento',
    name: 'Almacenamiento',
    type: 'ENUM',
    isRequired: false,
    isFilterable: true,
    options: [
      { id: 'opt-64', value: '64GB' },
      { id: 'opt-128', value: '128GB' },
    ],
  },
  {
    id: 'd3',
    code: 'reparado',
    name: 'Reparado',
    type: 'BOOLEAN',
    isRequired: false,
    isFilterable: false,
  },
];

describe('presentación del inventario', () => {
  it('formatea precios en pesos colombianos sin decimales', () => {
    const formatted = formatPrice(1_250_000);
    expect(formatted).toContain('1.250.000');
    expect(formatted).not.toContain(',00');
  });

  it('etiqueta todos los estados y condiciones del contrato', () => {
    expect(Object.keys(LISTING_STATUS_LABELS)).toEqual(['DRAFT', 'PUBLISHED', 'SOLD', 'ARCHIVED']);
    expect(Object.keys(LISTING_CONDITION_LABELS)).toEqual([
      'NEW',
      'LIKE_NEW',
      'GOOD',
      'FAIR',
      'FOR_PARTS',
    ]);
    expect(Object.keys(STATUS_TONES)).toHaveLength(4);
  });

  it('explica el siguiente paso según el estado', () => {
    expect(listingStateHint('DRAFT', false)).toMatch(/borrador/i);
    expect(listingStateHint('PUBLISHED', true)).toMatch(/destacado/i);
    expect(listingStateHint('SOLD', false)).toMatch(/vendido/i);
    expect(listingStateHint('ARCHIVED', false)).toMatch(/archivado/i);
  });

  it('resume atributos omitiendo los vacíos y traduciendo booleanos', () => {
    const summary = attributesSummary(definitions, {
      marca: 'Sony',
      almacenamiento: '',
      reparado: true,
    });
    expect(summary).toEqual([
      { label: 'Marca', value: 'Sony' },
      { label: 'Reparado', value: 'Sí' },
    ]);
  });

  it('solo considera publicable una publicación con imágenes', () => {
    expect(isPublishable({ images: [] })).toBe(false);
    expect(
      isPublishable({
        images: [
          {
            id: 'i1',
            url: 'http://localhost:3001/media/x.png',
            mimeType: 'image/png',
            sizeBytes: 10,
            width: 1,
            height: 1,
            position: 0,
          },
        ],
      }),
    ).toBe(true);
  });
});

describe('subida de imágenes', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('envía multipart sin fijar Content-Type y devuelve la imagen', async () => {
    const response = {
      id: 'img-1',
      url: 'http://localhost:3001/media/listings/x.png',
      mimeType: 'image/png',
      sizeBytes: 120,
      width: 10,
      height: 10,
      position: 0,
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => response,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'foto.png', { type: 'image/png' });
    const image = await uploadListingImage('listing-9', file);

    expect(image).toEqual(response);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/businesses/me/listings/listing-9/images');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toBeUndefined();
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('convierte un error del API en ApiError con su código', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        statusCode: 400,
        error: 'INVALID_IMAGE_TYPE',
        message: 'Imagen inválida',
      }),
    }) as unknown as typeof fetch;

    await expect(
      uploadListingImage('listing-9', new File(['x'], 'falsa.png', { type: 'image/png' })),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_IMAGE_TYPE' });
  });
});
