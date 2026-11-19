import type { MetadataRoute } from 'next';

import { SITE_URL, businessPath, fetchPublicSitemap, listingPath } from '@/lib/public-catalog';

/**
 * Sitemap dinámico.
 *
 * Solo incluye páginas canónicas e indexables: home, catálogo global, una entrada
 * por vertical, y las publicaciones y perfiles que el API considera visibles hoy.
 * Si el API no responde se devuelve únicamente el sitemap estático, para no
 * publicar URLs muertas ni romper el build.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/marketplace`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
  ];

  const entries = await fetchPublicSitemap();
  if (!entries) return staticEntries;

  const verticals = new Map<string, Date>();
  const dynamicEntries: MetadataRoute.Sitemap = [];

  for (const entry of entries) {
    if (!verticals.has(entry.verticalSlug)) {
      verticals.set(entry.verticalSlug, new Date(entry.updatedAt));
    }

    dynamicEntries.push({
      url: `${SITE_URL}${
        entry.listingSlug
          ? listingPath({ businessSlug: entry.businessSlug, listingSlug: entry.listingSlug })
          : businessPath(entry.businessSlug)
      }`,
      lastModified: new Date(entry.updatedAt),
      changeFrequency: entry.listingSlug ? 'weekly' : 'daily',
      priority: entry.listingSlug ? 0.7 : 0.5,
    });

    // Las tiendas tienen además su catálogo completo: es una URL canónica e
    // independiente de la portada, así que también se indexa.
    if (!entry.listingSlug) {
      dynamicEntries.push({
        url: `${SITE_URL}${businessPath(entry.businessSlug)}/catalogo`,
        lastModified: new Date(entry.updatedAt),
        changeFrequency: 'daily',
        priority: 0.4,
      });
    }
  }

  const verticalEntries: MetadataRoute.Sitemap = [...verticals.entries()].map(
    ([slug, updatedAt]) => ({
      url: `${SITE_URL}/marketplace/${slug}`,
      lastModified: updatedAt,
      changeFrequency: 'daily',
      priority: 0.8,
    }),
  );

  return [...staticEntries, ...verticalEntries, ...dynamicEntries];
}
