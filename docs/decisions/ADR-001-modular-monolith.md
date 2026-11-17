# ADR-001 — Monolito modular con dos aplicaciones

| Campo | Valor |
|-------|-------|
| **Estado** | **APROBADA** |
| **Fecha** | 2026-11-12 |
| **Decisor** | Responsable del proyecto (Prompt 01) |
| **Ámbito** | Forma de despliegue y límites funcionales |
| **Relacionados** | [ADR-002](ADR-002-hexagonal-architecture.md), [03](../03-system-architecture.md), [05](../05-modules-and-responsibilities.md) |

---

## 1. Contexto

El producto necesita: (a) un marketplace público indexable y rápido, (b) paneles privados por negocio, (c) un backend con reglas de negocio y autorización multi-tenant, y (d) automatizaciones futuras. El equipo es pequeño y el MVP no tiene requisitos de escala que justifiquen operar múltiples servicios.

Se evaluó si las dos aplicaciones (web y api) constituyen microservicios y si conviene separar dominios en servicios independientes.

## 2. Alternativas

| Alternativa | Descripción | Evaluación |
|-------------|-------------|------------|
| **A. Monolito modular (elegida)** | Una API NestJS con módulos por capacidad; Next.js como aplicación separada; worker como proceso aparte | Límites claros, un solo despliegue de API, transacciones locales, operación simple |
| B. Monolito "en capas" sin módulos | controllers/services/repositories globales | Rápido al inicio, pero los límites se diluyen y la autorización se dispersa |
| C. Microservicios por dominio | Listings, Leads, Billing como servicios | Aísla fallos, pero exige mensajería, consistencia distribuida, más infraestructura y equipo |
| D. Serverless por función | Funciones independientes | Cold starts, dispersión de reglas, difícil de razonar para un MVP |
| E. Next.js full-stack (sin API) | Todo en Next.js | Rompe el requisito de que solo NestJS acceda a la base de datos y concentra reglas en el frontend |

## 3. Decisión

**Monolito modular**: una aplicación `api` (NestJS) organizada por módulos de negocio con dependencias explícitas, una aplicación `web` (Next.js) que consume la API por HTTP, y un proceso `worker` para tareas asíncronas (outbox, expiraciones, procesamiento de medios). Un solo repositorio (pnpm + Turborepo).

La separación `web` / `api` es una **separación de aplicaciones y responsabilidades**, no de microservicios: comparten despliegue lógico, base de datos y ciclo de vida del producto.

## 4. Consecuencias

**Positivas**

- Transacciones locales y consistencia fuerte donde importa (publicación, suscripción, lead).
- Un solo modelo de autorización y un solo lugar donde viven las reglas.
- Operación y despliegue simples; costos bajos.
- Los módulos se pueden extraer a servicios si el crecimiento lo exige, porque los límites ya existen.

**Negativas**

- La API escala como unidad: un módulo con problema de rendimiento afecta a todos.
- Requiere disciplina para no crear dependencias cruzadas.
- Un fallo de despliegue afecta a todos los módulos.

**Mitigaciones**

- Límites verificados con reglas de importación y revisión de código.
- Procesos pesados fuera de la API (worker).
- Métricas por módulo para detectar acoplamientos de rendimiento.

## 5. Criterios para revisar esta decisión

1. Un módulo necesita escalar de forma independiente y sostenida (p. ej. 10× el resto).
2. Un equipo distinto necesita ciclos de despliegue independientes.
3. Un requisito regulatorio exige aislar datos en un despliegue separado.
4. El costo de coordinar un monolito supera el de operar servicios (evidencia medida, no percepción).

Mientras no se cumpla alguno, se mantiene el monolito modular.
