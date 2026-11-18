import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/public-catalog';

/**
 * robots.txt.
 *
 * El catálogo público se indexa; los paneles privados, las rutas de sesión y el
 * API no. Cada página privada además exige autenticación en el servidor, así que
 * esto es una cortesía para los rastreadores, no un control de acceso.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/admin',
          '/login',
          '/register',
          '/recuperar',
          '/restablecer',
          '/api',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
