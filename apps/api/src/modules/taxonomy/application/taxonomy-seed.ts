import type { PrismaClient } from '@prisma/client';

/**
 * Taxonomía inicial de la plataforma (E3, ampliada en E5-F1 de tiendas).
 *
 * Es idempotente: usa `upsert` con `update: {}` para no pisar los cambios que un
 * administrador haya hecho desde el panel. Se ejecuta desde `prisma/seed.ts` y se
 * vuelve a invocar en las pruebas para comprobar que no duplica nada.
 *
 * Las verticales base replican el comercio real del centro de Medellín y se siembran
 * **sin categorías ni atributos**, salvo Prenderías, que conserva la taxonomía de
 * referencia de E3. Las categorías del resto se crean desde el panel de taxonomía
 * cuando el negocio las necesite: inventarlas aquí sería hardcodear producto.
 */
export type SeedAttributeType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'ENUM';

export interface TaxonomySeedAttribute {
  name: string;
  code: string;
  type: SeedAttributeType;
  options: readonly string[];
}

export interface TaxonomySeedCategory {
  name: string;
  slug: string;
  attributes: readonly TaxonomySeedAttribute[];
}

export interface TaxonomySeedVertical {
  name: string;
  slug: string;
  categories: readonly TaxonomySeedCategory[];
}

/** Verticales base, en el orden en que se muestran en la plataforma. */
export const BASE_VERTICALS: readonly TaxonomySeedVertical[] = [
  { name: 'Moda Hombre', slug: 'moda-hombre', categories: [] },
  { name: 'Moda Mujer', slug: 'moda-mujer', categories: [] },
  { name: 'Calzado y Tenis', slug: 'calzado-y-tenis', categories: [] },
  { name: 'Tecnología y Electrónica', slug: 'tecnologia-y-electronica', categories: [] },
  { name: 'Hogar y Muebles', slug: 'hogar-y-muebles', categories: [] },
  { name: 'Joyerías y Relojerías', slug: 'joyerias-y-relojerias', categories: [] },
  { name: 'Restaurantes y Comida', slug: 'restaurantes-y-comida', categories: [] },
  { name: 'Juguetería y Variedades', slug: 'jugueteria-y-variedades', categories: [] },
  {
    name: 'Prenderías',
    slug: 'prenderias',
    categories: [
      {
        name: 'Celulares',
        slug: 'celulares',
        attributes: [
          { name: 'Marca', code: 'marca', type: 'TEXT', options: [] },
          {
            name: 'Almacenamiento',
            code: 'almacenamiento',
            type: 'ENUM',
            options: ['64GB', '128GB', '256GB'],
          },
        ],
      },
      {
        name: 'Computadores',
        slug: 'computadores',
        attributes: [
          { name: 'Marca', code: 'marca', type: 'TEXT', options: [] },
          { name: 'RAM', code: 'ram', type: 'NUMBER', options: [] },
        ],
      },
    ],
  },
];

export const TAXONOMY_SEED = { verticals: BASE_VERTICALS } as const;

export interface TaxonomySeedSummary {
  /** Cantidad de verticales garantizadas por el seed. */
  verticals: number;
  /** Slugs sembrados, para que el log y las pruebas no dependan del orden. */
  slugs: string[];
  categories: number;
  attributes: number;
  options: number;
}

/** Inserta (si faltan) las verticales, sus categorías, atributos y opciones. */
export async function seedTaxonomy(prisma: PrismaClient): Promise<TaxonomySeedSummary> {
  const { verticals } = TAXONOMY_SEED;

  const slugs: string[] = [];
  let categories = 0;
  let attributes = 0;
  let options = 0;

  for (const vertical of verticals) {
    const verticalRow = await prisma.vertical.upsert({
      where: { slug: vertical.slug },
      update: {},
      create: { name: vertical.name, slug: vertical.slug, isActive: true },
    });
    slugs.push(verticalRow.slug);

    for (const category of vertical.categories) {
      // Las categorías globales no tienen `business_id`: se buscan por vertical+slug.
      const existingCategory = await prisma.category.findFirst({
        where: { verticalId: verticalRow.id, slug: category.slug, businessId: null },
      });
      const categoryRow =
        existingCategory ??
        (await prisma.category.create({
          data: {
            verticalId: verticalRow.id,
            name: category.name,
            slug: category.slug,
          },
        }));
      categories += 1;

      for (const attribute of category.attributes) {
        const attributeRow = await prisma.attributeDefinition.upsert({
          where: { categoryId_code: { categoryId: categoryRow.id, code: attribute.code } },
          update: {},
          create: {
            categoryId: categoryRow.id,
            name: attribute.name,
            code: attribute.code,
            type: attribute.type,
            isRequired: false,
            isFilterable: true,
          },
        });
        attributes += 1;

        for (const value of attribute.options) {
          await prisma.attributeOption.upsert({
            where: {
              attributeDefinitionId_value: {
                attributeDefinitionId: attributeRow.id,
                value,
              },
            },
            update: {},
            create: { attributeDefinitionId: attributeRow.id, value },
          });
          options += 1;
        }
      }
    }
  }

  return { verticals: slugs.length, slugs, categories, attributes, options };
}
