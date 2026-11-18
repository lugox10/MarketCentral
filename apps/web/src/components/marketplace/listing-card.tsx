import Link from 'next/link';

import { cityLabel, conditionLabel, formatCop, listingPath } from '@/lib/public-catalog';
import type { PublicListingCard } from '@/lib/public-catalog';

interface ListingCardProps {
  listing: PublicListingCard;
  priority?: boolean;
}

/** Tarjeta de publicación del catálogo público (sin estado, apta para servidor). */
export function ListingCard({ listing, priority = false }: ListingCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:border-brand-700/40 hover:shadow-md">
      <Link
        href={listingPath(listing)}
        className="relative block aspect-[4/3] overflow-hidden bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        aria-label={`Ver ${listing.title} de ${listing.businessName}`}
      >
        {listing.image?.url ? (
          // La imagen la sirve el API (disco local o S3/R2), no el optimizador de Next,
          // por eso se usa <img> con lazy loading en lugar de next/image.
          <img
            src={listing.image.url}
            alt={listing.image.alt}
            loading={priority ? 'eager' : 'lazy'}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-stone-500">
            Sin imagen
          </span>
        )}

        {listing.featured ? (
          <span className="absolute left-3 top-3 rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-semibold text-white">
            Destacado
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-base font-semibold text-stone-900">
          {formatCop(listing.priceAmount, listing.currency)}
        </p>
        <h3 className="line-clamp-2 text-sm font-medium text-stone-800">
          <Link href={listingPath(listing)} className="hover:text-brand-700">
            {listing.title}
          </Link>
        </h3>
        <p className="text-xs text-stone-500">
          {listing.categoryName} · {conditionLabel(listing.condition)}
        </p>
        <p className="mt-auto text-xs text-stone-500">
          <Link
            href={`/negocio/${listing.businessSlug}`}
            className="font-medium text-stone-700 hover:text-brand-700"
          >
            {listing.businessName}
          </Link>{' '}
          · {cityLabel(listing.city)}
        </p>
      </div>
    </article>
  );
}

/** Rejilla responsive de publicaciones con estado vacío. */
export function ListingGrid({ listings }: { listings: PublicListingCard[] }) {
  if (listings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-stone-800">
          No encontramos publicaciones con esos filtros
        </p>
        <p className="mt-1 text-sm text-stone-500">
          Prueba con otra categoría, ciudad o rango de precio.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((listing, index) => (
        <ListingCard
          key={`${listing.businessSlug}-${listing.listingSlug}`}
          listing={listing}
          priority={index < 4}
        />
      ))}
    </div>
  );
}
