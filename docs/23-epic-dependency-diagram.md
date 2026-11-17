# 23 — Diagrama de dependencias entre épicas e historias

- **Estado:** APROBADO (C-13, 2026-11-12, junto con el roadmap)
- **Fecha:** 2026-11-12
- **Complementa:** `docs/22-implementation-roadmap.md`
- **Uso:** ordenar el trabajo y detectar qué se puede paralelizar. Si una flecha no existe, no hay
  dependencia: dos historias sin camino entre ellas pueden ejecutarse en cualquier orden.

---

## 1. Dependencias entre épicas

```mermaid
flowchart TB
  subgraph Fundación
    E0["E0 · Cierre bootstrap<br/>y entorno<br/>5 historias · 5 d"]
    E1["E1 · Identidad<br/>y sesiones<br/>6 · 9 d"]
    E2["E2 · Negocios<br/>y multi-tenancy<br/>5 · 7 d"]
  end

  subgraph Configuración
    E3["E3 · Taxonomía<br/>y atributos<br/>5 · 7 d"]
    E4["E4 · Planes<br/>y suscripciones<br/>6 · 9 d"]
  end

  subgraph Producto
    E5["E5 · Publicaciones<br/>y medios<br/>7 · 11 d"]
    E6["E6 · Catálogo<br/>público y SEO<br/>6 · 9 d"]
    E7["E7 · Contacto<br/>y Leads<br/>5 · 7 d"]
  end

  subgraph Operación
    E8["E8 · Admin, moderación<br/>y auditoría<br/>5 · 7 d"]
    E9["E9 · Observabilidad,<br/>seguridad y E2E<br/>6 · 8 d"]
    E10["E10 · Outbox<br/>y eventos v1<br/>4 · 6 d"]
  end

  E0 --> E1
  E1 --> E2
  E2 --> E3
  E2 --> E4
  E3 --> E5
  E4 --> E5
  E5 --> E6
  E5 --> E7
  E2 --> E8
  E4 --> E8
  E6 --> E9
  E7 --> E9
  E8 --> E9
  E5 --> E10
  E7 --> E10
  E4 --> E10

  E0 -.->|"bloquea por documentación"| E5
```

Lectura:

- **E3 y E4 son paralelizables.** Ambas dependen de E2, ninguna depende de la otra y E5 espera a las
  dos. Es el único punto del plan donde dos perfiles rinden al 100 % sin pisarse.
- **E6 y E7 son paralelizables** una vez cerrada E5: E6 es mayoritariamente frontend y lectura,
  E7 añade escritura de leads y panel.
- **E8 depende de E2 y E4**, no de E5: la moderación de publicaciones usa `Listings.ArchiveListing`, que
  ya existe al cerrar E5. En la práctica E8 arranca después de E5 por disponibilidad de contenido que
  moderar, no por bloqueo técnico.
- **E9 cierra el MVP**: no aporta funcionalidad nueva, consolida calidad y observabilidad.
- **E10 es opcional** para el MVP: si el tiempo aprieta, se entrega E10-H1/H3 (contrato y outbox) y se
  deja E10-H2/H4 para después.

---

## 2. Camino crítico

```
E0-H1 → E0-H3 → E0-H4 → E1-H1 → E1-H2 → E2-H1 → E2-H2 → E4-H1 → E4-H2 → E4-H3 → E4-H6
      → E5-H1 → E5-H2 → E5-H4 → E5-H5 → E5-H6 → E6-H1 → E6-H2 → E6-H4 → E7-H2 → E7-H3
      → E9-H6 → E9-H4
```

Duración del camino: **~52 días** de los 85 totales. La diferencia (33 días) es el margen que permite
paralelizar E3, E7, E8 y E9-H1…H5 con un segundo perfil. Con dos perfiles, la estimación realista del
MVP es **11–12 semanas**.

---

## 3. Dependencias por historia

Solo se listan las dependencias que **bloquean**. Las dependencias «de conveniencia» (misma pantalla,
mismo DTO) no aparecen.

```mermaid
flowchart LR
  subgraph E0
    E0H1["E0-H1 verificación real"]
    E0H2["E0-H2 git"]
    E0H3["E0-H3 Neon"]
    E0H4["E0-H4 env y secretos"]
    E0H5["E0-H5 postgres local"]
  end

  subgraph E1
    E1H1["E1-H1 app_user"]
    E1H2["E1-H2 registro"]
    E1H3["E1-H3 sesión"]
    E1H4["E1-H4 reset"]
    E1H5["E1-H5 rate limit auth"]
    E1H6["E1-H6 correo"]
  end

  subgraph E2
    E2H1["E2-H1 business"]
    E2H2["E2-H2 alta negocio"]
    E2H3["E2-H3 ActorContext"]
    E2H4["E2-H4 perfil"]
    E2H5["E2-H5 membresías"]
  end

  subgraph E3
    E3H1["E3-H1 vertical/category"]
    E3H2["E3-H2 attribute_definition"]
    E3H3["E3-H3 validador"]
    E3H4["E3-H4 seed Prenderías"]
    E3H5["E3-H5 taxonomía pública"]
  end

  subgraph E4
    E4H1["E4-H1 plan"]
    E4H2["E4-H2 subscription"]
    E4H3["E4-H3 Free al crear"]
    E4H4["E4-H4 activación manual"]
    E4H5["E4-H5 vencimiento"]
    E4H6["E4-H6 visibilidad"]
  end

  subgraph E5
    E5H1["E5-H1 listing"]
    E5H2["E5-H2 crear"]
    E5H3["E5-H3 editar"]
    E5H4["E5-H4 media"]
    E5H5["E5-H5 imágenes/orden"]
    E5H6["E5-H6 publicar"]
    E5H7["E5-H7 estados"]
  end

  E0H3 --> E0H4
  E0H2 --> E0H5
  E0H4 --> E1H1
  E0H5 --> E1H1
  E1H1 --> E1H2
  E1H1 --> E1H3
  E1H6 --> E1H2
  E1H1 --> E1H4
  E1H6 --> E1H4
  E1H3 --> E1H5

  E1H1 --> E2H1
  E2H1 --> E2H2
  E1H2 --> E2H2
  E2H1 --> E2H3
  E1H3 --> E2H3
  E2H2 --> E2H4
  E2H3 --> E2H4
  E2H2 --> E2H5

  E2H3 --> E3H1
  E1H3 --> E3H1
  E3H1 --> E3H2
  E3H2 --> E3H3
  E3H2 --> E3H4
  E3H4 --> E3H5

  E0H5 --> E4H1
  E2H1 --> E4H1
  E4H1 --> E4H2
  E2H1 --> E4H2
  E4H2 --> E4H3
  E2H2 --> E4H3
  E4H2 --> E4H4
  E4H2 --> E4H5
  E4H2 --> E4H6
  E2H2 --> E4H6

  E3H1 --> E5H1
  E2H4 --> E5H1
  E4H2 --> E5H1
  E5H1 --> E5H2
  E3H3 --> E5H2
  E5H2 --> E5H3
  E2H3 --> E5H4
  E0H4 --> E5H4
  E5H4 --> E5H5
  E5H2 --> E5H5
  E4H1 --> E5H5
  E5H5 --> E5H6
  E4H6 --> E5H6
  E5H6 --> E5H7
```

---

## 4. Olas de ejecución (un perfil)

| Ola | Historias | Duración acumulada |
| --- | --------- | ------------------ |
| 1 | E0-H1…H5 | 5 d |
| 2 | E1-H1, E1-H6, E1-H2, E1-H3, E1-H4, E1-H5 | 14 d |
| 3 | E2-H1…H5 | 21 d |
| 4 | E3-H1…H5 y E4-H1…H6 (secuencial en un perfil) | 37 d |
| 5 | E5-H1…H7 | 48 d |
| 6 | E6-H1…H6 | 57 d |
| 7 | E7-H1…H5 | 64 d |
| 8 | E8-H1…H5 | 71 d |
| 9 | E9-H1…H6 | 79 d |
| 10 | E10-H1…H4 | 85 d |

---

## 5. Olas con dos perfiles

| Ola | Perfil A (backend) | Perfil B (frontend/QA) |
| --- | ------------------ | ---------------------- |
| 1 | E0-H1, E0-H3, E0-H4, E0-H5 | E0-H2, plantilla de PR, revisión de `.gitignore` |
| 2 | E1-H1, E1-H2, E1-H4, E1-H6 | E1-H3, E1-H5, pantallas de auth |
| 3 | E2-H1, E2-H2, E2-H3 | E2-H4, E2-H5, panel de negocio |
| 4 | E4-H1…H6 | E3-H1…H5 (API y seed) + pantallas de taxonomía |
| 5 | E5-H1, E5-H2, E5-H4, E5-H6 | E5-H3, E5-H5, E5-H7, UI de publicación |
| 6 | E7-H1, E7-H2, E7-H4 | E6-H1…H6 (catálogo y SEO) |
| 7 | E8-H1…H5 | E7-H3, E7-H5, panel de leads |
| 8 | E9-H1…H4, E10 | E9-H5, E9-H6 |

Con dos perfiles el camino crítico cae a ~11 semanas; el cuello es la secuencia
E1 → E2 → E4 → E5 → E6 → E9-H6.

---

## 6. Puntos de sincronización (puertas)

| Puerta | Qué debe estar cerrado | Impide |
| ------ | ---------------------- | ------ |
| P1 — fin E0 | Bootstrap sin workarounds, Neon creado, Postgres local sano | Empezar identidad con entorno inestable |
| P2 — fin E2 | Aislamiento probado con T-01…T-12 | Cualquier épica con datos de negocio |
| P3 — fin E4 | Suscripción visible y límites aplicados | Publicar sin control de plan |
| P4 — fin E5 | Máquina de estados completa y pruebas E2E de publicación | Catálogo con datos inconsistentes |
| P5 — fin E8 | Moderación y auditoría operativas | Lanzamiento sin capacidad de reacción |
| P6 — fin E9 | Suite E2E verde, logs y límites activos | Declarar «MVP listo» |

---

## 7. Cómo actualizar este documento

1. Si una historia se divide, se añade con un sufijo (`E5-H4b`) y se actualizan las flechas.
2. Si cambia una dependencia, se corrige aquí **y** en `docs/22` §3; ambos deben coincidir.
3. Toda épica nueva entra con su nodo y su arista; no se permiten nodos huérfanos.
4. El diagrama se valida con el editor Mermaid antes de cada puerta de épica.
