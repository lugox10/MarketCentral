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

function PackageIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3 3 7.5V17l9 4.5 9-4.5V7.5z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9.5" />
    </Svg>
  );
}

const KEYWORDS: Array<{ match: string[]; icon: (props: IconProps) => React.ReactElement }> = [
  { match: ['joya', 'jewel'], icon: GemIcon },
  { match: ['prender', 'celular', 'electro'], icon: SmartphoneIcon },
  { match: ['ropa', 'moda', 'textil'], icon: ShirtIcon },
  { match: ['mueble', 'hogar'], icon: SofaIcon },
  { match: ['ferreter', 'herramienta', 'taller'], icon: WrenchIcon },
  { match: ['reloj'], icon: WatchIcon },
];

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
