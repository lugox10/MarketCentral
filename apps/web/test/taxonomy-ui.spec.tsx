import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import AdminTaxonomyPage from '../app/admin/taxonomia/page';
import type { AttributeDefinition, Category, Vertical } from '../src/lib/taxonomy';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const verticals: Vertical[] = [
  {
    id: 'v1',
    name: 'Prenderías',
    slug: 'prenderias',
    isActive: true,
    createdAt: '2026-11-14T12:00:00.000Z',
    updatedAt: '2026-11-14T12:00:00.000Z',
  },
];

const categories: Category[] = [
  {
    id: 'c1',
    verticalId: 'v1',
    name: 'Celulares',
    slug: 'celulares',
    parentId: null,
    createdAt: '2026-11-14T12:00:00.000Z',
    updatedAt: '2026-11-14T12:00:00.000Z',
  },
];

const attributes: AttributeDefinition[] = [
  {
    id: 'a1',
    categoryId: 'c1',
    name: 'Almacenamiento',
    code: 'almacenamiento',
    type: 'ENUM',
    isRequired: false,
    isFilterable: true,
    options: [
      { id: 'o1', value: '64GB' },
      { id: 'o2', value: '128GB' },
    ],
    createdAt: '2026-11-14T12:00:00.000Z',
    updatedAt: '2026-11-14T12:00:00.000Z',
  },
];

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function installFetch(overrides: (url: string) => Response | null = () => null): jest.Mock {
  const mock = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const override = overrides(url);
    if (override) return override;

    if (url.endsWith('/auth/me')) return json(200, { role: 'SUPER_ADMIN' });
    if (url.endsWith('/taxonomy/verticals')) return json(200, { items: verticals });
    if (url.endsWith('/taxonomy/verticals/v1/categories')) {
      return json(200, { verticalId: 'v1', items: categories });
    }
    if (url.endsWith('/taxonomy/categories/c1/attributes')) {
      return json(200, { categoryId: 'c1', items: attributes });
    }
    return json(404, { statusCode: 404, error: 'NOT_FOUND', message: 'No encontrado' });
  });

  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

function firstButton(name: RegExp): HTMLElement {
  const [button] = screen.getAllByRole('button', { name });
  if (!button) throw new Error('Boton no encontrado');
  return button;
}

async function renderLoaded(): Promise<void> {
  render(<AdminTaxonomyPage />);
  await screen.findByRole('heading', { name: /administración de taxonomía/i });
  await screen.findByText('Prenderías');
}

describe('Panel de taxonomía (UI)', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    installFetch();
  });

  it('muestra el encabezado, la ruta de navegación y los contadores reales', async () => {
    await renderLoaded();

    expect(screen.getByRole('navigation', { name: /ruta de navegación/i })).toBeTruthy();
    expect(screen.getAllByText('Verticales').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText('1 categorías')).toBeTruthy();
    });
  });

  it('filtra la lista de verticales y muestra el estado vacío de búsqueda', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText(/buscar verticales/i), {
      target: { value: 'joyerías' },
    });

    expect(await screen.findByText('Sin coincidencias')).toBeTruthy();
  });

  it('abre el modal de creación y lo cierra con Escape', async () => {
    await renderLoaded();

    fireEvent.click(firstButton(/nueva vertical/i));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^nombre$/i)).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('muestra el mensaje específico ante un conflicto 409', async () => {
    installFetch((url) =>
      url.endsWith('/admin/taxonomy/verticals')
        ? json(409, { statusCode: 409, error: 'DUPLICATE_VERTICAL', message: 'Ya existe' })
        : null,
    );

    await renderLoaded();

    fireEvent.click(firstButton(/nueva vertical/i));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/^nombre$/i), {
      target: { value: 'Prenderías' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear vertical/i }));

    expect(
      await within(dialog).findByText(/ya existe una vertical con ese nombre o slug/i),
    ).toBeTruthy();
  });

  it('valida el formulario antes de llamar a la API', async () => {
    const fetchMock = installFetch();
    await renderLoaded();

    fireEvent.click(firstButton(/nueva vertical/i));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/^nombre$/i), { target: { value: 'a' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear vertical/i }));

    expect(await within(dialog).findByText(/al menos 2 caracteres/i)).toBeTruthy();

    const postedToAdmin = fetchMock.mock.calls.some(
      ([input, init]) =>
        String(input).includes('/admin/taxonomy/verticals') &&
        (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(postedToAdmin).toBe(false);
  });

  it('navega vertical → categoría → atributos y muestra las opciones ENUM', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: /Prenderías/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Celulares/ }));

    expect(await screen.findByText('Almacenamiento')).toBeTruthy();
    expect(screen.getByText('64GB')).toBeTruthy();
    expect(screen.getByText('128GB')).toBeTruthy();
    expect(screen.getByText('Filtrable')).toBeTruthy();
  });

  it('redirige al login cuando no hay sesión', async () => {
    installFetch((url) =>
      url.endsWith('/auth/me')
        ? json(401, { statusCode: 401, error: 'UNAUTHENTICATED', message: 'Sin sesión' })
        : null,
    );

    render(<AdminTaxonomyPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
