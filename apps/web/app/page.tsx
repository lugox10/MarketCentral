import { Button } from '@marketcentral/ui';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-700">MarketCentral</p>

      <h1 className="text-3xl font-semibold leading-tight text-stone-900 sm:text-4xl">
        MarketCentral — en construcción
      </h1>

      <p className="max-w-prose text-base text-stone-600">
        Estamos preparando el marketplace de prenderías de Medellín y el Valle de Aburrá. Pronto
        podrás explorar publicaciones de negocios locales por categoría, ciudad y precio.
      </p>

      <Button disabled title="Disponible en una próxima entrega">
        Explorar catálogo (próximamente)
      </Button>

      <p className="text-xs text-stone-500">
        Esqueleto técnico del monorepo. Sin catálogo, sin cuentas y sin datos reales todavía.
      </p>
    </main>
  );
}
