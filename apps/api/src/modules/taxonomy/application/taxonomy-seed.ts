import type { PrismaClient } from '@prisma/client';

/**
 * Taxonomía inicial de la plataforma (E3).
 *
 * Es idempotente: usa `upsert` con `update: {}` para no pisar los cambios que un
 * administrador haya hecho desde el panel. Se ejecuta desde `prisma/seed.ts` y se
 * vuelve a invocar en las pruebas para comprobar que no duplica nada.
 */
export const TAXONOMY_SEED = {
  vertical: { name: 'Prenderías', slug: 'prenderias' },
  categories: [
    {
      name: 'Celulares',
      slug: 'celulares',
      attributes: [
        { name: 'Marca', code: 'marca', type: 'TEXT' as const, options: [] as string[] },
        {
          name: 'Almacenamiento',
          code: 'almacenamiento',
          type: 'ENUM' as const,
          options: ['64GB', '128GB', '256GB'],
        },
      ],
    },
    {
      name: 'Computadores',
      slug: 'computadores',
      attributes: [
        { name: 'Marca', code: 'marca', type: 'TEXT' as const, options: [] as string[] },
        { name: 'RAM', code: 'ram', type: 'NUMBER' as const, options: [] as string[] },
      ],
    },
  ],
} as const;

export interface TaxonomySeedSummary {
  vertical: string;
  categories: number;
  attributes: number;
  options: number;
}

/** Inserta (si faltan) la vertical, sus categorías, atributos y opciones. */
export async function seedTaxonomy(prisma: PrismaClient): Promise<TaxonomySeedSummary> {
  const { vertical, categories } = TAXONOMY_SEED;

  const verticalRow = await prisma.vertical.upsert({
    where: { slug: vertical.slug },
    update: {},
    create: { name: vertical.name, slug: vertical.slug, isActive: true },
  });

  let attributes = 0;
  let options = 0;

  for (const category of categories) {
    const categoryRow = await prisma.category.upsert({
      where: { verticalId_slug: { verticalId: verticalRow.id, slug: category.slug } },
      update: {},
      create: {
        verticalId: verticalRow.id,
        name: category.name,
        slug: category.slug,
      },
    });

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

  return { vertical: verticalRow.slug, categories: categories.length, attributes, options };
}
