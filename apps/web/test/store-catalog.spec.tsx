import { render, screen } from '@testing-library/react';

import { StoreCatalog } from '@/components/store/store-catalog';
import type { PublicBusiness } from '@/lib/public-catalog';
import { verticalTheme } from '@/lib/vertical-theme';

/**
 * Nota: el proyecto no configura @testing-library/jest-dom, así que las
 * aserciones usan `getAttribute` en vez de matchers como `toHaveAttribute`.
 */

function business(): PublicBusiness {
  return {
    id: 'b1',
    name: 'Prendería Centro',
    slug: 'prenderia-centro-1',
    verticalId: 'v1',
    verticalSlug: 'prenderias',
    verticalName: 'Prenderías',
    city: 'MEDELLIN',
    addressLine: 'Calle 1 # 2-3',
    whatsapp: '+573001112233',
    description: null,
    logoUrl: null,
    coverUrl: null,
    listings: { items: [], page: 1, limit: 12, total: 5, totalPages: 1 },
    categories: [
      { id: 'c1', name: 'Neveras', slug: 'neveras', parentId: null, count: 2 },
      { id: 'c2', name: 'Celulares', slug: 'celulares', parentId: null, count: 3 },
    ],
  } as PublicBusiness;
}

describe('catálogo interno de la tienda', () => {
  it('suma los conteos de las categorías en el chip «Todo»', () => {
    render(<StoreCatalog business={business()} theme={verticalTheme('prenderias')} page={1} />);

    const all = screen.getByRole('link', { name: /Todo\s*5/ });
    expect(all.getAttribute('href')).toBe('/negocio/prenderia-centro-1/catalogo');
  });

  it('enlaza cada categoría a su ruta propia', () => {
    render(<StoreCatalog business={business()} theme={verticalTheme('prenderias')} page={1} />);

    const neveras = screen.getByRole('link', { name: /Neveras\s*2/ });
    expect(neveras.getAttribute('href')).toBe('/negocio/prenderia-centro-1/categoria/neveras');
  });

  it('marca la categoría activa y mantiene el buscador apuntando al catálogo', () => {
    const { container } = render(
      <StoreCatalog
        business={business()}
        theme={verticalTheme('prenderias')}
        activeCategorySlug="celulares"
        page={1}
      />,
    );

    const celulares = screen.getByRole('link', { name: /Celulares\s*3/ });
    expect(celulares.getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('form')?.getAttribute('action')).toBe(
      '/negocio/prenderia-centro-1/catalogo',
    );
  });
});
