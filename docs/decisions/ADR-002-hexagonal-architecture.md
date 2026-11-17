# ADR-002 — Arquitectura hexagonal pragmática en el backend

| Campo | Valor |
|-------|-------|
| **Estado** | **APROBADA** |
| **Fecha** | 2026-11-12 |
| **Decisor** | Responsable del proyecto (Prompt 01) |
| **Ámbito** | Organización interna de cada módulo del backend |
| **Relacionados** | [ADR-001](ADR-001-modular-monolith.md), [03 §4](../03-system-architecture.md), [05](../05-modules-and-responsibilities.md) |

---

## 1. Contexto

El backend debe sostener reglas de negocio no triviales (visibilidad del catálogo, límites por plan, transiciones de estado, aislamiento multi-tenant) sin quedar acoplado a HTTP, Prisma o proveedores externos. Al mismo tiempo, el equipo es pequeño y el MVP incluye mucho CRUD simple.

Aplicar hexagonal de forma ceremonial (una interfaz y un repositorio por cada tabla, capas vacías, DTOs duplicados en cada capa) agregaría costo sin valor. No aplicarla en absoluto llevaría a controladores con reglas y consultas Prisma dispersas.

## 2. Alternativas

| Alternativa | Descripción | Evaluación |
|-------------|-------------|------------|
| **A. Hexagonal pragmática (elegida)** | Hexagonal donde hay reglas; CRUD simple con controlador → caso de uso → repositorio Prisma | Equilibrio entre testabilidad y velocidad |
| B. Hexagonal estricta en todo | Puertos/adaptadores y entidades para cada operación | Ceremonia alta; retrasa el MVP |
| C. Capas técnicas globales | `controllers/`, `services/`, `repositories/` | Fácil al inicio; pierde límites de negocio |
| D. Sin capas (controlador + Prisma) | Máxima velocidad | Reglas dispersas, difícil de probar y de aislar |

## 3. Decisión

Adoptar **arquitectura hexagonal pragmática** dentro de cada módulo con lógica de negocio:

```
┌────────────────────── módulo (p. ej. Listings) ──────────────────────┐
│                                                                      │
│  inbound adapters          application            domain             │
│  ─────────────────         ───────────            ──────             │
│  ListingController   →     PublishListing    →    Listing            │
│  (HTTP, DTO, guards)       (orquesta)             PublicationPolicy  │
│                                │                  ListingState       │
│                                ▼                                     │
│                           ports (outbound)                           │
│                           ListingRepository                          │
│                           ListingReadModel                           │
│                           EventPublisher                             │
│                                ▲                                     │
│  outbound adapters             │                                     │
│  PrismaListingRepository ──────┘                                     │
│  OutboxEventPublisher                                                │
└──────────────────────────────────────────────────────────────────────┘
```

**Reglas de dependencia**

1. `domain` no importa NestJS, Prisma, HTTP ni SDKs.
2. `application` depende de `domain` y de puertos; no de adaptadores.
3. Los adaptadores dependen de `application`/`domain` (implementan sus puertos).
4. Un módulo no importa archivos internos de otro: solo su API pública (`index.ts`) o su contrato de eventos.
5. Los controladores no contienen reglas: validan forma, resuelven `ActorContext` y delegan.

**Criterio de cuándo crear dominio**

Un concepto pasa al dominio cuando cumple **al menos uno**:

- Tiene invariantes que deben cumplirse siempre (p. ej. "no se publica sin imagen procesada").
- Tiene una máquina de estados con transiciones restringidas.
- Su regla se repetiría en más de un caso de uso.
- Su error debe ser distinguishable y probarse sin base de datos.

Si solo es "guardar y leer un campo", no se crea entidad de dominio: caso de uso + repositorio.

**Prohibiciones**

- Entidades anémicas duplicadas entre capas sin propósito.
- `PrismaService` inyectado en el dominio o en casos de uso que deban ser independientes.
- Interfaces de puerto con un solo método trivial que nunca se va a sustituir (salvo que exista un adaptador de prueba real).
- Dependencias circulares entre módulos.

## 4. Consecuencias

**Positivas**

- Reglas críticas probadas sin HTTP ni base de datos.
- Cambiar Prisma o un proveedor no toca el dominio.
- Los límites del módulo son explícitos y revisables.

**Negativas**

- Más archivos que un CRUD directo; requiere criterio para no sobreingeniería.
- Riesgo de duplicar DTOs si no se define un mapeo claro.
- Curva de aprendizaje para quien no conoce el patrón.

**Mitigaciones**

- Plantilla de módulo documentada.
- Revisión de PR con checklist de dependencias.
- Ejemplos canónicos (Listings, Leads) en [03 §5](../03-system-architecture.md).

## 5. Criterios para revisar esta decisión

1. El equipo pasa más tiempo manteniendo capas que entregando valor.
2. Un módulo demuestra que su lógica es puramente CRUD y se simplifica.
3. Se adopta un framework que impone otra organización (poco probable).
4. La extracción de un módulo a servicio exige revisar los puertos.
