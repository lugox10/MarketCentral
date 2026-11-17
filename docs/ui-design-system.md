# Sistema de diseño — MarketCentral

**Estado:** APROBADA como guía canónica (D-39, 2026-11-17) · **Fecha:** 2026-11-17
**Fuente de verdad:** el código listado en §11. Este documento **describe** lo implementado; no inventa estilos.
**Referencia visual aprobada:** panel de Taxonomía (`apps/web/app/admin/taxonomia/page.tsx`) tras la mejora UX/UI de E3.

---

## 1. Principios

1. **Superficie neutra, un solo acento.** Fondo piedra (`stone`), tarjetas blancas, verde de marca solo para acción primaria, selección y foco.
2. **Densidad de panel administrativo.** Filas compactas, metadatos en 11–12 px, títulos en 14 px. La jerarquía se logra con peso y color, no con tamaño.
3. **Sin decoración.** Sombras suaves (`shadow-sm`), un radio por nivel (8/12/16 px), cero gradientes.
4. **Mobile-first.** Una columna hasta `lg`, luego tres. Los modales se convierten en hoja inferior en móvil.
5. **Nada depende de `hover`.** Toda acción es visible y alcanzable con teclado.

---

## 2. Color

### 2.1 Tokens de marca (`apps/web/app/globals.css`)

```css
@theme {
  --color-brand-50:  oklch(0.97 0.02 160);
  --color-brand-700: oklch(0.52 0.11 160);
  --color-brand-900: oklch(0.32 0.07 160);
}
```

| Token | Uso |
|---|---|
| `brand-50` | Fondo de elemento seleccionado, badge de marca |
| `brand-700` | Acción primaria, borde de foco, borde activo |
| `brand-900` | `hover` de la acción primaria, texto sobre `brand-50` |
| `#065f46` | `themeColor` del viewport (`layout.tsx`) — barra del navegador |

### 2.2 Neutros (paleta `stone` de Tailwind, sin tokens propios)

| Rol | Clase |
|---|---|
| Fondo de página | `bg-stone-50` |
| Superficie de tarjeta/panel | `bg-white` |
| Borde por defecto | `border-stone-200` |
| Borde de control (input, botón secundario) | `border-stone-300` |
| Texto principal | `text-stone-900` |
| Texto secundario | `text-stone-600` / `text-stone-700` |
| Metadatos, placeholders | `text-stone-500` / `text-stone-400` |
| Relleno de skeleton | `bg-stone-200` / `bg-stone-100` |
| Superficie deshabilitada | `bg-stone-100` |

### 2.3 Semánticos

| Significado | Fondo | Texto | Borde/anillo |
|---|---|---|---|
| Éxito | `bg-emerald-50` | `text-emerald-800/900` | `emerald-300` / `emerald-600/20` |
| Advertencia | `bg-amber-50` | `text-amber-800/900` | `amber-300` / `amber-600/25` |
| Error | `bg-red-50` | `text-red-800/900` | `red-300` / `red-600/20` |
| Información | `bg-sky-50` | `text-sky-900` | `sky-300` |

No hay modo oscuro. `html { color-scheme: light }` está fijado a propósito.

---

## 3. Tipografía

Tipografía del sistema (la de Tailwind por defecto); no se cargan fuentes web. `font-mono` solo para identificadores (`slug`, `code`).

| Nivel | Clases | Dónde |
|---|---|---|
| Título de página | `text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl` | `h1` del panel |
| Título de sección | `text-sm font-semibold text-stone-900` | cabecera de `Panel`, tarjeta |
| Cuerpo | `text-sm text-stone-700` | textos y formularios |
| Secundario | `text-xs text-stone-500` | ayudas, descripciones |
| Etiqueta de campo | `text-xs font-semibold text-stone-700` | `Field` |
| Métrica | `text-2xl font-semibold tabular-nums` | `StatCard` |
| Rótulo de métrica | `text-[11px] font-semibold uppercase tracking-wide text-stone-500` | `StatCard` |
| Badge | `text-[11px] font-medium` | `Badge` |
| Identificador | `font-mono text-[11px] text-stone-500` | slug y `code` |

---

## 4. Espaciado, radios y sombras

- **Escala:** múltiplos de 4 px (`gap-2/3/4`, `px-3/4/5`, `py-1.5/2/3/4`, `space-y-1.5/2`).
- **Radios:** `rounded-lg` (8 px) controles y botones · `rounded-xl` (12 px) tarjetas de lista, inputs de métrica, empty state · `rounded-2xl` (16 px) paneles y modal · `rounded-full` badges · `rounded-t-2xl` modal en móvil.
- **Sombras:** `shadow-sm` en superficies · `shadow-xl` solo en el modal. Nada de `shadow-md/lg` ni sombras de color.
- **Bordes:** 1 px siempre; `border-dashed` únicamente en `EmptyState`.

---

## 5. Botones (`buttonStyles`)

```ts
buttonStyles(variant?: 'primary' | 'secondary' | 'ghost', size?: 'sm' | 'md')
```

Base: `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60`

| Variante | Clases |
|---|---|
| `primary` | `bg-brand-700 text-white shadow-sm hover:bg-brand-900 focus-visible:outline-brand-700 disabled:bg-brand-700/60` |
| `secondary` | `border border-stone-300 bg-white text-stone-700 shadow-sm hover:bg-stone-100 focus-visible:outline-stone-500` |
| `ghost` | `text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-stone-500` |

| Tamaño | Clases |
|---|---|
| `sm` | `px-3 py-1.5 text-xs` |
| `md` | `px-4 py-2 text-sm` |

Uno y solo un botón `primary` por zona visible. Enviar un formulario deshabilita el botón (`disabled` + `opacity-60`).

> `packages/ui/src/button.tsx` es un **placeholder del bootstrap** (verde `emerald`, `rounded-md`) y no pertenece a este sistema. No debe usarse en pantallas nuevas; se retira cuando todas consuman `buttonStyles`.

---

## 6. Formularios

**Campo (`Field`):** contenedor `space-y-1.5`, label `text-xs font-semibold text-stone-700`, y debajo **o** el error (`text-xs font-medium text-red-700`) **o** la ayuda (`text-xs text-stone-500`). Nunca ambos.

**Control (`inputStyles`):**

```
w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm
placeholder:text-stone-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20
disabled:bg-stone-100
```

**Buscador (`SearchField`):** `type="search"`, icono lupa a la izquierda (`py-1.5 pl-8 pr-3`), etiqueta `sr-only`.
**Selects:** misma altura y borde que `inputStyles`; sin estilo nativo adicional.

Validación: mensaje específico bajo el campo, en español, sin jerga; los errores del backend se muestran tal cual cuando son de negocio (409) y se traducen cuando son técnicos (401/403/404/red).

---

## 7. Modal (`Modal`)

| Parte | Clases |
|---|---|
| Overlay | `fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-6` |
| Panel | `max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-stone-200 bg-white shadow-xl sm:rounded-2xl` |
| Cabecera | `flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4` · título `text-base font-semibold` · descripción `mt-1 text-sm text-stone-600` |
| Cuerpo | `px-5 py-4` |
| Pie | `flex flex-col-reverse gap-2 border-t border-stone-200 bg-stone-50 px-5 py-4 sm:flex-row sm:justify-end` |

Comportamiento obligatorio: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, cierre con `Escape` y clic en el fondo, foco atrapado (`Tab`/`Shift+Tab`), foco inicial en el primer campo, devolución del foco al abridor, `body.style.overflow = 'hidden'` mientras está abierto.

---

## 8. Tarjetas, paneles y badges

**Panel de columna:** `flex min-w-0 flex-col rounded-2xl border border-stone-200 bg-white shadow-sm`; la lista interior usa `lg:max-h-[26rem] lg:overflow-y-auto`.

**Tarjeta seleccionable** (`rounded-xl border px-3 py-2.5 text-left transition`):

- activa: `border-brand-700 bg-brand-50/70 shadow-sm`
- inactiva: `border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50`

**Tarjeta de dato:** `min-w-0 rounded-xl border border-stone-200 bg-white p-3 shadow-sm`.

**Badge:** `inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset`.

| Tono | Clases |
|---|---|
| `neutral` | `bg-stone-100 text-stone-700 ring-stone-200` |
| `brand` | `bg-brand-50 text-brand-900 ring-brand-700/20` |
| `success` | `bg-emerald-50 text-emerald-800 ring-emerald-600/20` |
| `warning` | `bg-amber-50 text-amber-800 ring-amber-600/25` |
| `danger` | `bg-red-50 text-red-800 ring-red-600/20` |
| `outline` | `bg-white text-stone-600 ring-stone-300` |

Convención semántica: `success` = activo/vigente · `warning` = por vencer/prueba · `danger` = suspendido/vencido · `neutral` = estado neutro · `brand` = selección o rol.

---

## 9. Estados y feedback

| Estado | Implementación |
|---|---|
| Carga inicial | `SkeletonList` (`animate-pulse`, barras `bg-stone-200` y `bg-stone-100`) |
| Envío en curso | botón `disabled` + texto de progreso; nunca doble envío |
| Vacío | `EmptyState` con título, descripción y una acción concreta |
| Sin coincidencias de búsqueda | `EmptyState` citando el término buscado |
| Éxito | `Banner tone="success"` descartable, `role="status"`, `aria-live="polite"` |
| Error | `Banner tone="error"`, `role="alert"`, `aria-live="assertive"` |
| Error de campo | mensaje bajo el campo (`Field error`) |
| Sin permisos | aviso persistente, sin acciones destructivas |

`Banner`: `flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm shadow-sm`.

---

## 10. Responsive y accesibilidad

**Breakpoints usados:** `sm` 640 px (modal centrado, pie en fila, `sm:text-3xl`) y `lg` 1024 px (tres columnas). No se usan `md`, `xl` ni `2xl` en las pantallas actuales.

**Reglas que las pantallas deben cumplir:**

1. Ningún contenedor con ancho fijo; `min-w-0` en paneles y tarjetas para permitir `truncate`.
2. Nombres, slugs y códigos se truncan (`truncate`), nunca parten el layout.
3. Tablas → tarjetas o listas con scroll controlado; no hay componente de tabla.
4. Modales: hoja inferior en móvil, centrados desde `sm`; `max-h-[92vh]` con scroll interno.
5. Área táctil mínima 32 px de alto (`py-1.5` mínimo en `sm`); acciones principales con `py-2`.
6. Sin acciones exclusivas de `hover`.

**Accesibilidad:**

- Foco visible siempre: `focus-visible:outline-2 focus-visible:outline-offset-2` con el color de la variante.
- `aria-current` en el elemento seleccionado; `aria-label` en botones con solo icono.
- Etiquetas reales (`label for`) o `sr-only` cuando el diseño no muestra texto.
- Iconos `aria-hidden="true"`; SVG inline con `stroke-width` 1.5–1.6 y `currentColor`.
- Contraste: texto `stone-900`/`stone-700` sobre blanco y `stone-50`; nunca `stone-400` para texto informativo.

---

## 11. Fuente de verdad en código

| Archivo | Qué define |
|---|---|
| `apps/web/app/globals.css` | Tokens `brand-*`, fondo y color base |
| `apps/web/app/layout.tsx` | `lang="es"`, `themeColor` |
| `apps/web/src/components/taxonomy-ui.tsx` | `buttonStyles`, `Badge`, `StatCard`, `SearchField`, `EmptyState`, `SkeletonList`, `Field`, `inputStyles`, `Banner` |
| `apps/web/src/components/modal.tsx` | `Modal` accesible |
| `apps/web/app/admin/taxonomia/page.tsx` | `Panel`, tarjeta seleccionable, cabecera con breadcrumb, chips de ruta, grid de tres columnas |
| `packages/ui/src/button.tsx` | **Placeholder heredado, fuera del sistema** |

## 12. Huecos conocidos (no implementados todavía)

- No hay componente de tabla, paginación, tooltip, toast ni menú desplegable.
- No hay iconografía unificada: cada pantalla dibuja sus SVG inline.
- No hay modo oscuro ni tokens de elevación más allá de `shadow-sm`/`shadow-xl`.
- No existe todavía `.superdesign/design-system.md`. **D-39 (aprobada):** esta guía es la canónica y el archivo de Superdesign no se genera por ahora; ver [25-e4-planning-and-decisions.md](25-e4-planning-and-decisions.md) §E cuando el CLI esté instalado.
