import { iconKeyFor } from '@/components/marketplace/vertical-icon';

describe('iconKeyFor', () => {
  it('asigna un icono propio a cada una de las 9 verticales base', () => {
    expect(iconKeyFor('moda-hombre')).toBe('shirt');
    expect(iconKeyFor('moda-mujer')).toBe('shirt');
    expect(iconKeyFor('calzado-y-tenis')).toBe('shoe');
    expect(iconKeyFor('tecnologia-y-electronica')).toBe('smartphone');
    expect(iconKeyFor('hogar-y-muebles')).toBe('sofa');
    expect(iconKeyFor('joyerias-y-relojerias')).toBe('gem');
    expect(iconKeyFor('restaurantes-y-comida')).toBe('utensils');
    expect(iconKeyFor('jugueteria-y-variedades')).toBe('toy');
    expect(iconKeyFor('prenderias')).toBe('recycle');
  });

  it('prioriza joyería sobre relojería cuando el slug menciona ambas', () => {
    expect(iconKeyFor('joyerias-y-relojerias')).toBe('gem');
    expect(iconKeyFor('relojeria-el-reloj')).toBe('watch');
  });

  it('usa el icono genérico para verticales creadas a mano', () => {
    expect(iconKeyFor('ferreteria-central')).toBe('wrench');
    expect(iconKeyFor('vertical-nueva')).toBe('package');
    expect(iconKeyFor('')).toBe('package');
  });
});
