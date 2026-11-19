/**
 * Tema visual por vertical (D-42).
 *
 * La vertical es la unidad de identidad visual: todas las tiendas de la misma
 * vertical comparten paleta, y el dueño no elige colores en el MVP. La paleta
 * se resuelve en render, así que mejorar un tema actualiza todas las tiendas de
 * esa vertical sin migrar datos.
 *
 * Las clases se escriben completas (no interpoladas) para que Tailwind las
 * encuentre al compilar.
 */
export interface VerticalTheme {
  slug: string;
  /** Color de marca del sector, en texto. */
  accentText: string;
  /** Botón principal del sector. */
  accentBg: string;
  accentHover: string;
  accentRing: string;
  /** Fondo suave para secciones y chips activos. */
  softBg: string;
  softBorder: string;
  /** Degradado de la portada de la tienda. */
  coverGradient: string;
  /** Etiqueta corta del sector, para el badge de la tienda. */
  label: string;
}

const THEMES: Record<string, VerticalTheme> = {
  prenderias: {
    slug: 'prenderias',
    accentText: 'text-emerald-800',
    accentBg: 'bg-emerald-700',
    accentHover: 'hover:bg-emerald-800',
    accentRing: 'focus-visible:outline-emerald-700',
    softBg: 'bg-emerald-50',
    softBorder: 'border-emerald-200',
    coverGradient: 'from-emerald-900 via-emerald-800 to-teal-700',
    label: 'Prendería',
  },
  'moda-hombre': {
    slug: 'moda-hombre',
    accentText: 'text-slate-800',
    accentBg: 'bg-slate-800',
    accentHover: 'hover:bg-slate-900',
    accentRing: 'focus-visible:outline-slate-800',
    softBg: 'bg-slate-50',
    softBorder: 'border-slate-200',
    coverGradient: 'from-slate-900 via-slate-800 to-stone-700',
    label: 'Moda hombre',
  },
  'moda-mujer': {
    slug: 'moda-mujer',
    accentText: 'text-rose-800',
    accentBg: 'bg-rose-700',
    accentHover: 'hover:bg-rose-800',
    accentRing: 'focus-visible:outline-rose-700',
    softBg: 'bg-rose-50',
    softBorder: 'border-rose-200',
    coverGradient: 'from-rose-900 via-rose-800 to-pink-700',
    label: 'Moda mujer',
  },
  'calzado-y-tenis': {
    slug: 'calzado-y-tenis',
    accentText: 'text-sky-800',
    accentBg: 'bg-sky-700',
    accentHover: 'hover:bg-sky-800',
    accentRing: 'focus-visible:outline-sky-700',
    softBg: 'bg-sky-50',
    softBorder: 'border-sky-200',
    coverGradient: 'from-sky-900 via-sky-800 to-cyan-700',
    label: 'Calzado y tenis',
  },
  'tecnologia-y-electronica': {
    slug: 'tecnologia-y-electronica',
    accentText: 'text-indigo-800',
    accentBg: 'bg-indigo-700',
    accentHover: 'hover:bg-indigo-800',
    accentRing: 'focus-visible:outline-indigo-700',
    softBg: 'bg-indigo-50',
    softBorder: 'border-indigo-200',
    coverGradient: 'from-indigo-950 via-indigo-800 to-violet-700',
    label: 'Tecnología',
  },
  'hogar-y-muebles': {
    slug: 'hogar-y-muebles',
    accentText: 'text-teal-800',
    accentBg: 'bg-teal-700',
    accentHover: 'hover:bg-teal-800',
    accentRing: 'focus-visible:outline-teal-700',
    softBg: 'bg-teal-50',
    softBorder: 'border-teal-200',
    coverGradient: 'from-teal-900 via-teal-800 to-emerald-700',
    label: 'Hogar y muebles',
  },
  'joyerias-y-relojerias': {
    slug: 'joyerias-y-relojerias',
    accentText: 'text-amber-800',
    accentBg: 'bg-amber-600',
    accentHover: 'hover:bg-amber-700',
    accentRing: 'focus-visible:outline-amber-600',
    softBg: 'bg-amber-50',
    softBorder: 'border-amber-200',
    coverGradient: 'from-amber-900 via-amber-800 to-yellow-700',
    label: 'Joyería',
  },
  'restaurantes-y-comida': {
    slug: 'restaurantes-y-comida',
    accentText: 'text-orange-800',
    accentBg: 'bg-orange-600',
    accentHover: 'hover:bg-orange-700',
    accentRing: 'focus-visible:outline-orange-600',
    softBg: 'bg-orange-50',
    softBorder: 'border-orange-200',
    coverGradient: 'from-orange-900 via-orange-800 to-red-700',
    label: 'Restaurante',
  },
  'jugueteria-y-variedades': {
    slug: 'jugueteria-y-variedades',
    accentText: 'text-violet-800',
    accentBg: 'bg-violet-700',
    accentHover: 'hover:bg-violet-800',
    accentRing: 'focus-visible:outline-violet-700',
    softBg: 'bg-violet-50',
    softBorder: 'border-violet-200',
    coverGradient: 'from-violet-900 via-violet-800 to-fuchsia-700',
    label: 'Juguetería',
  },
};

/** Tema neutro para verticales creadas a mano o desconocidas. */
const FALLBACK: VerticalTheme = {
  slug: 'default',
  accentText: 'text-brand-700',
  accentBg: 'bg-brand-700',
  accentHover: 'hover:bg-brand-900',
  accentRing: 'focus-visible:outline-brand-700',
  softBg: 'bg-brand-50',
  softBorder: 'border-brand-700/20',
  coverGradient: 'from-brand-900 via-brand-700 to-emerald-600',
  label: 'Tienda',
};

export function verticalTheme(slug: string | null | undefined): VerticalTheme {
  if (!slug) return FALLBACK;
  return THEMES[slug] ?? FALLBACK;
}

export const VERTICAL_THEME_SLUGS = Object.keys(THEMES);
