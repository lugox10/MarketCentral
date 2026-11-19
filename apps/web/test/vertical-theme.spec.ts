import { VERTICAL_THEME_SLUGS, verticalTheme } from '../src/lib/vertical-theme';

const EXPECTED = [
  'prenderias',
  'moda-hombre',
  'moda-mujer',
  'calzado-y-tenis',
  'tecnologia-y-electronica',
  'hogar-y-muebles',
  'joyerias-y-relojerias',
  'restaurantes-y-comida',
  'jugueteria-y-variedades',
];

describe('tema por vertical (D-42)', () => {
  it('define un tema para las 9 verticales base', () => {
    expect([...VERTICAL_THEME_SLUGS].sort()).toEqual([...EXPECTED].sort());
    for (const slug of EXPECTED) {
      const theme = verticalTheme(slug);
      expect(theme.slug).toBe(slug);
      expect(theme.accentBg).toMatch(/^bg-/);
      expect(theme.coverGradient).toContain('from-');
      expect(theme.label.length).toBeGreaterThan(0);
    }
  });

  it('cada vertical tiene un degradado distinto', () => {
    const gradients = new Set(EXPECTED.map((slug) => verticalTheme(slug).coverGradient));
    expect(gradients.size).toBe(EXPECTED.length);
  });

  it('cae en el tema neutro para verticales creadas a mano o sin dato', () => {
    expect(verticalTheme('ferreteria-del-barrio').slug).toBe('default');
    expect(verticalTheme(null).slug).toBe('default');
    expect(verticalTheme(undefined).accentBg).toBe('bg-brand-700');
  });
});
