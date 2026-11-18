import { render, screen } from '@testing-library/react';

import { ListingCard, ListingGrid } from '@/components/marketplace/listing-card';
import type { PublicListingCard } from '@/lib/public-catalog';

const listing: PublicListingCard = {
  businessSlug: 'tecnomedellin',
  businessName: 'TecnoMedellín',
  listingSlug: 'iphone-13-128gb',
  title: 'iPhone 13 128GB como nuevo',
  priceCop: 2_150_000,
  currency: 'COP',
  condition: 'LIKE_NEW',
  city: 'BELLO',
  categoryId: 'cat-1',
  categoryName: 'Celulares',
  categorySlug: 'celulares',
  featured: true,
  publishedAt: '2026-11-17T12:00:00.000Z',
  image: {
    url: 'http://127.0.0.1:3002/media/listings/a.png',
    width: 800,
    height: 600,
    alt: 'iPhone 13',
  },
};

describe('ListingCard', () => {
  it('muestra precio, título, categoría, condición, negocio y ciudad', () => {
    render(<ListingCard listing={listing} />);

    expect(screen.getByRole('heading', { name: listing.title })).toBeTruthy();
    expect(screen.getByText(/2\.150\.000/)).toBeTruthy();
    expect(screen.getByText(/Celulares · Como nuevo/)).toBeTruthy();
    expect(screen.getByText('TecnoMedellín')).toBeTruthy();
    expect(screen.getByText(/· Bello/)).toBeTruthy();
  });

  it('marca las publicaciones destacadas y enlaza al detalle canónico', () => {
    render(<ListingCard listing={listing} />);

    expect(screen.getByText('Destacado')).toBeTruthy();
    const links = screen.getAllByRole('link');
    const detailLinks = links.filter(
      (link) => link.getAttribute('href') === '/producto/tecnomedellin/iphone-13-128gb',
    );
    expect(detailLinks).toHaveLength(2);
  });

  it('no marca como destacada una publicación normal', () => {
    render(<ListingCard listing={{ ...listing, featured: false, image: null }} />);

    expect(screen.queryByText('Destacado')).toBeNull();
    expect(screen.getByText('Sin imagen')).toBeTruthy();
  });
});

describe('ListingGrid', () => {
  it('muestra el estado vacío cuando no hay publicaciones', () => {
    render(<ListingGrid listings={[]} />);

    expect(screen.getByText('No encontramos publicaciones con esos filtros')).toBeTruthy();
  });

  it('renderiza una tarjeta por publicación', () => {
    render(
      <ListingGrid
        listings={[listing, { ...listing, listingSlug: 'otro', title: 'Otro artículo usado' }]}
      />,
    );

    expect(screen.getAllByRole('article')).toHaveLength(2);
  });
});
