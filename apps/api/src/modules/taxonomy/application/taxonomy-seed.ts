import type { PrismaClient } from '@prisma/client';

/**
 * Taxonomía base de MarketCentral.
 *
 * Se siembra de forma idempotente: las verticales, categorías, atributos y
 * opciones que ya existen se respetan (no se renombran ni se borran) y solo se
 * añade lo que falte. Así el seed puede correr en cada despliegue sin pisar los
 * ajustes que el SUPER_ADMIN haya hecho desde el panel.
 *
 * Regla de negocio: el catálogo solo pide lo que ayuda a comprar. Precio, foto
 * y categoría ya son obligatorios en la publicación; los atributos nacen
 * opcionales para no frenar al dueño que prefiere cerrar por WhatsApp.
 */

export type SeedAttributeType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'ENUM';

export interface SeedAttribute {
  code: string;
  name: string;
  type: SeedAttributeType;
  isFilterable: boolean;
  options?: string[];
}

export interface SeedCategory {
  slug: string;
  name: string;
  attributes: SeedAttribute[];
}

export interface SeedVertical {
  slug: string;
  name: string;
  categories: SeedCategory[];
}

export interface TaxonomySeedSummary {
  verticals: number;
  slugs: string[];
  categories: number;
  attributes: number;
  options: number;
}

const text = (code: string, name: string, isFilterable = true): SeedAttribute => ({
  code,
  name,
  type: 'TEXT',
  isFilterable,
});

const choice = (
  code: string,
  name: string,
  options: string[],
  isFilterable = true,
): SeedAttribute => ({
  code,
  name,
  type: 'ENUM',
  isFilterable,
  options,
});

/** Ropa: adultos y niños comparten estructura, cambian las tallas. */
const garments = (): SeedCategory[] => [
  {
    slug: 'ropa-adulto',
    name: 'Ropa Adulto',
    attributes: [
      choice('talla', 'Talla', ['XS', 'S', 'M', 'L', 'XL', 'XXL']),
      text('color', 'Color'),
      text('material', 'Material'),
      choice('tipo', 'Tipo de prenda', [
        'Camisa',
        'Camiseta',
        'Pantalón',
        'Jean',
        'Chaqueta',
        'Sudadera',
        'Vestido',
        'Falda',
        'Otro',
      ]),
      text('marca', 'Marca'),
    ],
  },
  {
    slug: 'ropa-nino',
    name: 'Ropa Niño/Niña',
    attributes: [
      choice('edad-talla', 'Edad / Talla', ['2', '4', '6', '8', '10', '12', '14']),
      text('color', 'Color'),
      choice('tipo', 'Tipo de prenda', ['Camiseta', 'Pantalón', 'Conjunto', 'Vestido', 'Otro']),
    ],
  },
  {
    slug: 'accesorios',
    name: 'Accesorios',
    attributes: [
      choice('tipo', 'Tipo', ['Gorra', 'Bolso', 'Cinturón', 'Billetera', 'Bufanda', 'Otro']),
      text('color', 'Color'),
      text('material', 'Material'),
    ],
  },
  {
    slug: 'ropa-deportiva',
    name: 'Ropa Deportiva',
    attributes: [
      choice('talla', 'Talla', ['XS', 'S', 'M', 'L', 'XL', 'XXL']),
      choice('deporte', 'Deporte', ['Fútbol', 'Gimnasio', 'Running', 'Ciclismo', 'Otro']),
      text('color', 'Color'),
    ],
  },
];

/** Calzado: tallas europeas para adultos y tallas infantiles. */
const footwear = (): SeedCategory[] => [
  {
    slug: 'calzado-adulto',
    name: 'Calzado Adulto',
    attributes: [
      choice('talla', 'Talla', ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']),
      text('color', 'Color'),
      text('marca', 'Marca'),
      choice('tipo', 'Tipo', [
        'Tenis',
        'Zapatilla',
        'Bota',
        'Botín',
        'Sandalia',
        'Zapato formal',
        'Otro',
      ]),
      text('material', 'Material'),
    ],
  },
  {
    slug: 'calzado-nino',
    name: 'Calzado Niño',
    attributes: [
      choice('talla', 'Talla', ['20', '22', '24', '26', '28', '30', '32', '34']),
      text('color', 'Color'),
      text('marca', 'Marca'),
    ],
  },
  {
    slug: 'botas-y-botines',
    name: 'Botas y Botines',
    attributes: [
      choice('talla', 'Talla', ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']),
      text('color', 'Color'),
      text('material', 'Material'),
    ],
  },
  {
    slug: 'sandalias-y-chanclas',
    name: 'Sandalias y Chanclas',
    attributes: [
      choice('talla', 'Talla', ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44']),
      text('color', 'Color'),
    ],
  },
];

export const BASE_VERTICALS: SeedVertical[] = [
  {
    slug: 'moda-hombre',
    name: 'Moda Hombre',
    categories: garments(),
  },
  {
    slug: 'moda-mujer',
    name: 'Moda Mujer',
    categories: garments(),
  },
  {
    slug: 'calzado-y-tenis',
    name: 'Calzado y Tenis',
    categories: footwear(),
  },
  {
    slug: 'tecnologia-y-electronica',
    name: 'Tecnología y Electrónica',
    categories: [
      {
        slug: 'celulares',
        name: 'Celulares',
        attributes: [
          text('marca', 'Marca'),
          choice('almacenamiento', 'Almacenamiento', ['64GB', '128GB', '256GB', '512GB']),
          choice('ram', 'RAM', ['4GB', '6GB', '8GB', '12GB']),
          text('color', 'Color'),
          text('bateria', 'Estado de la batería', false),
        ],
      },
      {
        slug: 'computadores',
        name: 'Computadores',
        attributes: [
          text('marca', 'Marca'),
          text('procesador', 'Procesador'),
          choice('ram', 'RAM', ['8GB', '16GB', '32GB']),
          choice('almacenamiento', 'Almacenamiento', ['256GB SSD', '512GB SSD', '1TB SSD']),
          text('pantalla', 'Pantalla', false),
        ],
      },
      {
        slug: 'tablets',
        name: 'Tablets',
        attributes: [
          text('marca', 'Marca'),
          choice('almacenamiento', 'Almacenamiento', ['64GB', '128GB', '256GB']),
          choice('ram', 'RAM', ['3GB', '4GB', '6GB', '8GB']),
        ],
      },
      {
        slug: 'audio',
        name: 'Audio',
        attributes: [
          choice('tipo', 'Tipo', ['Diadema', 'Audífonos', 'Parlante', 'Soundbar', 'Otro']),
          text('marca', 'Marca'),
          choice('conexion', 'Conexión', ['Bluetooth', 'Cable', 'Inalámbrico', 'Otro']),
        ],
      },
      {
        slug: 'consolas-y-videojuegos',
        name: 'Consolas y Videojuegos',
        attributes: [
          choice('plataforma', 'Plataforma', [
            'PlayStation',
            'Xbox',
            'Nintendo',
            'PC',
            'Retro',
            'Otro',
          ]),
          text('marca', 'Marca'),
        ],
      },
      {
        slug: 'accesorios-tecnologicos',
        name: 'Accesorios Tecnológicos',
        attributes: [
          choice('tipo', 'Tipo', [
            'Cargador',
            'Cable',
            'Funda',
            'Protector de pantalla',
            'Soporte',
            'Otro',
          ]),
          text('marca', 'Marca'),
        ],
      },
    ],
  },
  {
    slug: 'hogar-y-muebles',
    name: 'Hogar y Muebles',
    categories: [
      {
        slug: 'muebles',
        name: 'Muebles',
        attributes: [
          text('material', 'Material'),
          text('color', 'Color'),
          text('dimensiones', 'Dimensiones', false),
          choice('tipo', 'Tipo', ['Sala', 'Comedor', 'Alcoba', 'Oficina', 'Otro']),
        ],
      },
      {
        slug: 'electrodomesticos',
        name: 'Electrodomésticos',
        attributes: [
          text('marca', 'Marca'),
          choice('garantia', 'Garantía', ['Sí', 'No']),
          choice('tipo', 'Tipo', [
            'Nevera',
            'Lavadora',
            'Microondas',
            'Estufa',
            'Licuadora',
            'Otro',
          ]),
        ],
      },
      {
        slug: 'decoracion',
        name: 'Decoración',
        attributes: [text('tipo', 'Tipo'), text('material', 'Material'), text('color', 'Color')],
      },
      {
        slug: 'iluminacion',
        name: 'Iluminación',
        attributes: [text('tipo', 'Tipo'), text('material', 'Material')],
      },
      {
        slug: 'colchones',
        name: 'Colchones',
        attributes: [
          choice('tamano', 'Tamaño', ['Sencillo', 'Semidoble', 'Doble', 'Queen', 'King']),
          text('material', 'Material'),
        ],
      },
    ],
  },
  {
    slug: 'joyerias-y-relojerias',
    name: 'Joyerías y Relojerías',
    categories: [
      {
        slug: 'anillos',
        name: 'Anillos',
        attributes: [
          choice('material', 'Material', ['Oro', 'Plata', 'Acero']),
          choice('talla', 'Talla', ['4', '5', '6', '7', '8', '9', '10']),
          text('piedra', 'Piedra', false),
        ],
      },
      {
        slug: 'relojes',
        name: 'Relojes',
        attributes: [
          text('marca', 'Marca'),
          choice('tipo-de-correa', 'Tipo de correa', ['Cuero', 'Metal', 'Silicona']),
          choice('genero', 'Género', ['Hombre', 'Mujer', 'Unisex']),
          choice('movimiento', 'Movimiento', ['Analógico', 'Digital', 'Automático']),
        ],
      },
      {
        slug: 'cadenas-y-pulseras',
        name: 'Cadenas y Pulseras',
        attributes: [
          choice('material', 'Material', ['Oro', 'Plata', 'Acero', 'Baño de oro']),
          text('largo', 'Largo', false),
        ],
      },
      {
        slug: 'aretes',
        name: 'Aretes',
        attributes: [
          choice('material', 'Material', ['Oro', 'Plata', 'Acero', 'Baño de oro']),
          choice('tipo', 'Tipo', ['Argolla', 'Topo', 'Candonga', 'Otro']),
        ],
      },
    ],
  },
  {
    slug: 'restaurantes-y-comida',
    name: 'Restaurantes y Comida',
    categories: [
      {
        slug: 'platos-a-la-carta',
        name: 'Platos a la carta',
        attributes: [
          choice('tipo', 'Tipo', ['Entrada', 'Fuerte', 'Postre']),
          text('ingredientes', 'Ingredientes', false),
          text('alergenos', 'Alérgenos', false),
          text('porciones', 'Porciones', false),
        ],
      },
      {
        slug: 'bebidas',
        name: 'Bebidas',
        attributes: [
          choice('tipo', 'Tipo', ['Caliente', 'Fría', 'Alcohólica', 'Sin alcohol']),
          text('tamano', 'Tamaño', false),
        ],
      },
      {
        slug: 'combos',
        name: 'Combos',
        attributes: [
          text('incluye', 'Incluye', false),
          choice('para-cuantas-personas', 'Para cuántas personas', ['1', '2', '3', '4 o más']),
        ],
      },
      {
        slug: 'panaderia-y-reposteria',
        name: 'Panadería y Repostería',
        attributes: [
          choice('tipo', 'Tipo', ['Pan', 'Torta', 'Postre', 'Otro']),
          text('porciones', 'Porciones', false),
        ],
      },
    ],
  },
  {
    slug: 'jugueteria-y-variedades',
    name: 'Juguetería y Variedades',
    categories: [
      {
        slug: 'juguetes',
        name: 'Juguetes',
        attributes: [
          choice('edad-recomendada', 'Edad recomendada', [
            '0-3 años',
            '4-8 años',
            '9-12 años',
            '+12 años',
          ]),
          text('material', 'Material'),
          choice('tipo', 'Tipo', [
            'Muñeca',
            'Vehículo',
            'Construcción',
            'Didáctico',
            'Pelota',
            'Otro',
          ]),
        ],
      },
      {
        slug: 'juegos-de-mesa',
        name: 'Juegos de Mesa',
        attributes: [
          choice('edad-recomendada', 'Edad recomendada', [
            '0-3 años',
            '4-8 años',
            '9-12 años',
            '+12 años',
          ]),
          text('jugadores', 'Número de jugadores', false),
          text('duracion', 'Duración', false),
        ],
      },
      {
        slug: 'articulos-de-fiesta',
        name: 'Artículos de Fiesta',
        attributes: [text('tipo', 'Tipo'), text('tema', 'Tema', false)],
      },
      {
        slug: 'papeleria',
        name: 'Papelería',
        attributes: [
          choice('tipo', 'Tipo', ['Cuaderno', 'Esfero', 'Kit escolar', 'Mochila', 'Otro']),
          text('marca', 'Marca'),
        ],
      },
    ],
  },
  {
    slug: 'prenderias',
    name: 'Prenderías',
    categories: [
      {
        slug: 'celulares',
        name: 'Celulares',
        attributes: [
          text('marca', 'Marca'),
          choice('almacenamiento', 'Almacenamiento', ['64GB', '128GB', '256GB', '512GB']),
          choice('ram', 'RAM', ['4GB', '6GB', '8GB', '12GB']),
        ],
      },
      {
        slug: 'computadores',
        name: 'Computadores',
        attributes: [
          text('marca', 'Marca'),
          text('procesador', 'Procesador'),
          choice('ram', 'RAM', ['8GB', '16GB', '32GB']),
          choice('almacenamiento', 'Almacenamiento', ['256GB SSD', '512GB SSD', '1TB SSD']),
        ],
      },
      {
        slug: 'herramientas',
        name: 'Herramientas',
        attributes: [
          text('tipo', 'Tipo'),
          text('marca', 'Marca'),
          text('voltaje', 'Voltaje', false),
        ],
      },
      {
        slug: 'electrodomesticos',
        name: 'Electrodomésticos',
        attributes: [
          text('marca', 'Marca'),
          choice('funcionamiento', 'Funcionamiento', [
            'Funciona',
            'Con detalles',
            'Para repuestos',
          ]),
        ],
      },
      {
        slug: 'muebles',
        name: 'Muebles',
        attributes: [
          text('material', 'Material'),
          text('color', 'Color'),
          text('dimensiones', 'Dimensiones', false),
        ],
      },
      {
        slug: 'bicicletas',
        name: 'Bicicletas',
        attributes: [
          choice('tipo', 'Tipo', ['Montaña', 'Ruta', 'BMX', 'Eléctrica', 'Otro']),
          choice('aro', 'Aro', ['26', '27.5', '29', 'Otro']),
          text('material', 'Material'),
        ],
      },
    ],
  },
];

export const TAXONOMY_SEED = { verticals: BASE_VERTICALS } as const;

/**
 * Aplica el seed. Devuelve cuántos elementos se **crearon** en esta ejecución
 * (los que ya existían no se cuentan ni se sobrescriben).
 */
export async function seedTaxonomy(prisma: PrismaClient): Promise<TaxonomySeedSummary> {
  const summary: TaxonomySeedSummary = {
    verticals: 0,
    slugs: [],
    categories: 0,
    attributes: 0,
    options: 0,
  };

  for (const verticalSeed of BASE_VERTICALS) {
    let vertical = await prisma.vertical.findUnique({ where: { slug: verticalSeed.slug } });

    if (!vertical) {
      vertical = await prisma.vertical.create({
        data: { slug: verticalSeed.slug, name: verticalSeed.name },
      });
      summary.verticals += 1;
    }

    summary.slugs.push(vertical.slug);

    for (const categorySeed of verticalSeed.categories) {
      let category = await prisma.category.findFirst({
        where: { verticalId: vertical.id, slug: categorySeed.slug, businessId: null },
      });

      if (!category) {
        category = await prisma.category.create({
          data: {
            verticalId: vertical.id,
            name: categorySeed.name,
            slug: categorySeed.slug,
          },
        });
        summary.categories += 1;
      }

      for (const attributeSeed of categorySeed.attributes) {
        const existing = await prisma.attributeDefinition.findUnique({
          where: { categoryId_code: { categoryId: category.id, code: attributeSeed.code } },
        });

        if (!existing) {
          await prisma.attributeDefinition.create({
            data: {
              categoryId: category.id,
              code: attributeSeed.code,
              name: attributeSeed.name,
              type: attributeSeed.type,
              isFilterable: attributeSeed.isFilterable,
              options: {
                create: (attributeSeed.options ?? []).map((value) => ({ value })),
              },
            },
          });
          summary.attributes += 1;
          summary.options += attributeSeed.options?.length ?? 0;
          continue;
        }

        // El atributo ya existe: se respetan los ajustes del panel y solo se
        // añaden las opciones nuevas de este seed.
        if (attributeSeed.options && attributeSeed.options.length > 0) {
          const created = await prisma.attributeOption.createMany({
            data: attributeSeed.options.map((value) => ({
              attributeDefinitionId: existing.id,
              value,
            })),
            skipDuplicates: true,
          });
          summary.options += created.count;
        }
      }
    }
  }

  return summary;
}
