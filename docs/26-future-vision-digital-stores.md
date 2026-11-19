# VISIÓN FUTURA DE MARKETCENTRAL — TIENDAS DIGITALES INDIVIDUALES POR NEGOCIO

## 1. PROPÓSITO

Queremos evolucionar MarketCentral más allá de un marketplace tradicional.

La visión es construir un ecosistema compuesto por:

1. Un marketplace global que reúne negocios y publicaciones de distintas verticales.
2. Una experiencia de tienda digital individual para cada negocio registrado.

El marketplace global funcionará como punto de descubrimiento y adquisición de compradores.

Cada negocio tendrá una experiencia pública propia, donde el comprador podrá navegar exclusivamente por su catálogo, conocer su identidad comercial y contactar directamente con el establecimiento.

La experiencia de cada tienda debe sentirse como una pequeña landigpage comercial independiente, aunque técnicamente forme parte de MarketCentral.

## 2. MARKETPLACE GLOBAL

La landing global es la puerta de entrada del ecosistema.

Debe permitir:

- Descubrir verticales.
- Explorar publicaciones de distintos negocios.
- Buscar y filtrar productos.
- Encontrar negocios.
- Comparar publicaciones.
- Acceder al perfil o tienda individual de cada negocio.
- Contactar al vendedor.

Los productos del marketplace deben conservar siempre su relación con el negocio propietario.

Cuando una tarjeta de producto o una ficha muestre el negocio vendedor, debe existir una acción clara:

**"Visitar tienda"**

Esta acción llevará al comprador a la experiencia individual del negocio.

No se pretende eliminar el catálogo agregado. Las dos experiencias deben coexistir.

## 3. TIENDA DIGITAL INDIVIDUAL

Cada negocio debe contar con una página pública que funcione como su propia tienda digital.

El comprador debe sentir que entró al sitio comercial de ese establecimiento y no que simplemente abrió otro filtro del marketplace.

La tienda debe contar con:

### Identidad comercial

- Nombre del negocio.
- Logo, si está disponible.
- Imagen de portada, si el modelo lo permite.
- Descripción comercial.
- Ubicación.
- Información pública de contacto.
- Identidad visual coherente con MarketCentral.

### Navegación propia

- Inicio de la tienda.
- Categorías del negocio.
- Catálogo disponible.
- Búsqueda dentro de su inventario.
- Filtros relevantes.
- Productos destacados.
- Productos recientes.

### Catálogo propio

Mostrar únicamente publicaciones del negocio correspondiente que cumplan la política pública de visibilidad.

No mezclar productos de otros negocios en esta experiencia.

Las tarjetas deben mostrar los datos pertinentes de cada publicación según la vertical.

### Detalle de publicación

El comprador podrá ingresar a una publicación desde la tienda y consultar:

- Imágenes.
- Precio.
- Condición.
- Descripción.
- Atributos dinámicos.
- Información del negocio.
- Opciones de contacto.

Debe existir navegación clara para volver a la tienda del negocio.

## 4. EXPERIENCIA ADAPTADA A CADA VERTICAL

Una característica fundamental es que todas las tiendas no deben verse exactamente iguales.

La estructura general puede ser compartida, pero la presentación debe adaptarse a la vertical del negocio.

Ejemplos:

### Prenderías

Podrían priorizar:
- Celulares.
- Computadores.
- Electrodomésticos.
- Herramientas.
- Relojes.
- Condición del producto.
- Marca.
- Modelo.
- Características técnicas.

### Joyerías

Podrían priorizar:
- Anillos.
- Cadenas.
- Pulseras.
- Aretes.
- Material.
- Tipo de piedra.
- Peso.
- Características específicas de la pieza.

Estos ejemplos son orientativos. Las categorías, filtros y atributos reales deben provenir de la taxonomía y configuración existentes.

No hardcodear una tienda distinta para cada vertical.

La solución debe permitir incorporar nuevas verticales sin tener que duplicar toda la aplicación.

## 5. EXPERIENCIA DEL COMPRADOR

Flujo esperado:

1. El comprador ingresa a MarketCentral.
2. Explora productos o verticales.
3. Encuentra una publicación de su interés.
4. Identifica el negocio vendedor.
5. Selecciona "Visitar tienda".
6. Ingresa a la tienda digital de ese negocio.
7. Navega por sus categorías y publicaciones.
8. Consulta un producto.
9. Contacta al negocio por los mecanismos habilitados.

El comprador debe poder regresar fácilmente al marketplace global.

También debe poder llegar a una tienda directamente mediante un enlace compartible.

## 6. IDENTIDAD VISUAL

Queremos una combinación de dos niveles:

**MarketCentral:**
- Identidad y estructura global.
- Navegación general.
- Confianza y consistencia.
- Experiencia común entre verticales.

**Negocio individual:**
- Identidad comercial propia.
- Logo y elementos visuales disponibles.
- Información de su establecimiento.
- Catálogo y categorías propias.
- Experiencia adaptada a su vertical.

No implementar personalización ilimitada de colores o temas sin evaluar previamente el modelo de negocio y los planes comerciales.

La prioridad es que cada tienda se sienta propia sin perder la coherencia visual del ecosistema.

## 7. ARQUITECTURA TÉCNICA DESEADA

La solución debe seguir siendo multi-tenant.

No crear una aplicación ni un backend independiente por negocio.

Debe reutilizar:

- Next.js App Router.
- Backend NestJS.
- PostgreSQL y Prisma.
- Módulo de Listings.
- Módulo de Businesses.
- Taxonomía global.
- Categorías propias.
- Atributos dinámicos.
- Política de visibilidad pública de E6.

La identidad de la tienda se resolverá mediante el identificador público del negocio, preferiblemente su slug.

Las consultas de inventario de la tienda siempre deben estar limitadas al negocio correspondiente.

Mantener aislamiento de datos y no confiar en identificadores suministrados libremente por el navegador.

## 8. EVOLUCIÓN FUTURA

Considerar, sin implementar todavía:

- Dominios o subdominios propios por negocio.
- Configuración comercial de portada.
- Secciones promocionales.
- Personalización de la apariencia según planes.
- Analítica de visitas y conversiones.
- Herramientas de posicionamiento SEO por tienda.
- Catálogos compartibles.
- Integraciones comerciales futuras.

Estas capacidades requieren análisis independiente y decisiones de producto.

No asumir que forman parte de la primera versión de las tiendas digitales.

## 9. REGLAS DE IMPLEMENTACIÓN FUTURA

Antes de desarrollar:

1. Auditar la experiencia actual de `/negocio/[businessSlug]`.
2. Revisar las rutas actuales de catálogo y detalle.
3. Identificar qué funcionalidades ya están implementadas.
4. Detectar qué se puede reutilizar.
5. Comparar la experiencia global con la experiencia individual.
6. Revisar las capacidades reales del modelo de negocios y verticales.
7. Identificar los cambios mínimos necesarios.
8. Presentar propuesta de UX, rutas y arquitectura.
9. Dividir la implementación en fases verificables.

No reconstruir funcionalidades que ya existen.

No duplicar endpoints ni lógica de negocio.

No modificar contratos existentes sin justificación.

No comenzar la implementación hasta contar con una propuesta técnica y visual aprobada.

## 10. RESULTADO ESPERADO

MarketCentral debe tener dos experiencias comerciales conectadas:

- Un marketplace global para descubrir productos y negocios.
- Una tienda digital individual para cada negocio, con su identidad, catálogo y experiencia adaptada a su vertical.

La sensación del comprador debe ser:

"Estoy navegando por MarketCentral, descubrí este negocio y ahora estoy dentro de su propia tienda digital."

Esta visión debe orientar las futuras decisiones de UX, arquitectura y evolución del producto.

IMPORTANTE:

Este documento comunica la visión futura del producto. No es una autorización para implementar cambios ahora.

Primero debe terminarse y validarse la mejora visual de la landing global. Posteriormente se realizará una auditoría de las tiendas individuales existentes y se definirá una propuesta de evolución.
