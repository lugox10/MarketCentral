/**
 * Iconos de vertical para la landing.
 *
 * No hay librería de iconos instalada y el Glow Up no puede añadir dependencias,
 * así que cada icono es un SVG en línea. El mapa va por palabra clave del slug:
 * una vertical nueva sin coincidencia usa el icono genérico, nunca se rompe.
 * Las verticales en sí vienen siempre de la API, no de esta lista.
 */

type IconProps = { className?: string };

function Svg({ children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

function GemIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20M9 3l-3 6 6 12 6-12-3-6" />
    </Svg>
  );
}

function SmartphoneIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </Svg>
  );
}

function ShirtIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 3 4 5.5 2.5 10l3 1.5V21h13V11.5l3-1.5L20 5.5 15 3l-3 2.5z" />
    </Svg>
  );
}

function SofaIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 12V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M2 13a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4H2z" />
      <path d="M5 17v3M19 17v3" />
    </Svg>
  );
}

function WrenchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14.5 6.5a4 4 0 1 0 5 5L21 21l-2 2-9.5-9.5a4 4 0 0 1-5-5l3 3 3-1 1-3z" />
    </Svg>
  );
}

function WatchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="5" />
      <path d="M9 3h6l-.5 4M9 21h6l-.5-4M12 9.5V12l1.5 1" />
    </Svg>
  );
}

function ShoeIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 16.5h18v2.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M3 16.5V12l4.5-1.5 2 3 3-1 2 3 3-1.5 3.5 2.5" />
      <path d="M8 12.5 9.5 9M13 12.5 14.5 9" />
    </Svg>
  );
}

function UtensilsIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9" />
      <path d="M15 3c-1.5 1.5-2 3.5-2 6 0 1.6.7 2.6 2 3v9" />
    </Svg>
  );
}

function ToyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="9" width="16" height="10" rx="2" />
      <path d="M7 9V6.5a2.5 2.5 0 0 1 5 0V9M14.5 7h2M17 5.5v3" />
      <path d="M8 13.5h.01M16 13.5h.01" />
    </Svg>
  );
}

function RecycleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m7 19-3-5 2.5-4M17 19h-6l-2-4M20 14l-2.5 4.5L14 19" />
      <path d="M10 6.5 12 3l3 5M7 11l2-4.5" />
    </Svg>
  );
}

function PackageIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3 3 7.5V17l9 4.5 9-4.5V7.5z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9.5" />
    </Svg>
  );
}

/**
 * Orden significativo: gana la primera palabra que aparece en el slug. Por eso
 * «joya» va antes que «reloj» (Joyerías y Relojerías comparte ambos términos) y
 * «moda» antes que cualquier otro término genérico.
 */
const KEYWORDS: Array<{
  key: string;
  match: string[];
  icon: (props: IconProps) => React.ReactElement;
}> = [
  { key: 'gem', match: ['joya', 'joyer', 'jewel', 'bisuter'], icon: GemIcon },
  { key: 'watch', match: ['reloj', 'watch'], icon: WatchIcon },
  { key: 'shirt', match: ['moda', 'ropa', 'textil', 'vestir'], icon: ShirtIcon },
  { key: 'shoe', match: ['calzado', 'zapato', 'tenis', 'shoe'], icon: ShoeIcon },
  {
    key: 'smartphone',
    match: ['tecnolog', 'electron', 'electro', 'celular', 'comput'],
    icon: SmartphoneIcon,
  },
  { key: 'sofa', match: ['hogar', 'mueble', 'decorac'], icon: SofaIcon },
  { key: 'utensils', match: ['comida', 'restaurant', 'cafeteria', 'cafe'], icon: UtensilsIcon },
  { key: 'toy', match: ['juguete', 'jugueter', 'toy'], icon: ToyIcon },
  { key: 'wrench', match: ['servicio', 'ferreter', 'herramienta', 'taller'], icon: WrenchIcon },
  { key: 'recycle', match: ['prender', 'segunda mano', 'usado'], icon: RecycleIcon },
];

/**
 * Clave del icono para un slug. Se exporta para poder probar el mapeo de todas
 * las verticales base sin depender del SVG renderizado.
 */
export function iconKeyFor(slug: string): string {
  const normalized = slug.toLowerCase();
  return (
    KEYWORDS.find((entry) => entry.match.some((word) => normalized.includes(word)))?.key ??
    'package'
  );
}

export function VerticalIcon({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}): React.ReactElement {
  const normalized = slug.toLowerCase();
  const found = KEYWORDS.find((entry) => entry.match.some((word) => normalized.includes(word)));
  const Icon = found?.icon ?? PackageIcon;
  return <Icon className={className} />;
}
