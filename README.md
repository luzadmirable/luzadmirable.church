# Luz Admirable

Sitio de los documentos normativos de la iglesia Luz Admirable: el documento de
membresía y las bases doctrinales. Todo el texto es editable desde un panel
propio en `/admin`; no hay nada escrito a mano en el código.

## Stack

- Next.js 16 (App Router, Cache Components) + React 19 + TypeScript
- Tailwind 4 — los colores salen del logotipo y viven en `src/app/globals.css`
- Lakebase Postgres en Neon + Drizzle ORM, con `node-postgres` (`pg`)
- Tiptap para el editor de texto
- Sesión por cookie firmada con `jose`

## Puesta en marcha

El proyecto ya está enlazado a Neon (`.neon` apunta al proyecto
`divine-base-94649016`, rama `production`). Para traer las variables y arrancar:

```bash
npx neon@latest login     # una vez por máquina
npx neon@latest env pull  # escribe DATABASE_URL y DATABASE_URL_UNPOOLED en .env.local
npm run db:migrate        # aplica las migraciones de drizzle/
npm run import:tratado    # carga el tratado desde brand/fuentes/
npm run dev
```

Cambia `ADMIN_PASSWORD` en `.env.local`. El sitio queda en
`http://localhost:3000` y el panel en `/admin`.

### Conexiones: pooled y directa

Neon entrega dos cadenas y cada una tiene su papel:

- `DATABASE_URL` (con `-pooler`) — la que usa la app. Es lo que Neon recomienda
  para Vercel con Fluid compute.
- `DATABASE_URL_UNPOOLED` — conexión directa, solo para migraciones. Es la que
  lee `drizzle.config.ts`.

El driver es `node-postgres` (`pg`), no `@neondatabase/serverless`: en Vercel el
pool se reutiliza entre invocaciones y `attachDatabasePool` de `@vercel/functions`
permite drenarlo cuando la instancia se suspende.

## Cómo está modelado el documento

Dos tablas (`src/db/schema.ts`):

- `documents` — un registro por documento. Hoy solo está el tratado
  «Misión, Visión y Servicio»; la membresía y las bases doctrinales se añadirán
  cuando sus textos estén listos.
- `nodes` — el árbol completo en una tabla autorreferenciada. Cada nodo es un
  `section` (capítulo), un `article` (artículo) o un `clause` (inciso), cuelga
  de un `parent_id` y se ordena entre hermanos con `position`. La profundidad es
  libre.

### Rótulos y numeración

El rótulo de un nodo tiene **tres** estados, no dos:

| `label` | Significa |
|---|---|
| `null` | derivarlo con `number_format` |
| `""` | sin rótulo — apartados que en el original no llevan número |
| texto | literal, gana sobre todo |

`number_format` es una plantilla con tres fichas: `{n}` arábigo, `{R}` romano,
`{a}` letra. Así conviven en el mismo sitio documentos con convenciones
distintas: los estatutos numeran `Capítulo {R}` y `Artículo {n}`, mientras el
tratado numera sus principios `{R}.` sin palabra delante. Si va en `null` se
usa la convención por defecto del tipo.

Al crear un hermano nuevo se copia la plantilla del anterior del mismo tipo, de
modo que añadir el principio XIII no obliga a reconfigurar nada.

La numeración no se guarda: se calcula al leer (`src/lib/tree.ts`). Los capítulos
van en romanos, los artículos llevan un contador corrido por todo el documento
—como se cita un texto normativo— y los incisos en letras. Si hace falta un
rótulo distinto, se escribe a mano en el campo *Rótulo* y ese gana.

Cada nodo tiene un `slug` que funciona como ancla permanente:
`/membresia#articulo-7-admision`. Solo se regenera mientras el título siga
siendo el que puso el sistema, para no romper enlaces ya citados.

## Caché

Las lecturas van con `"use cache"` y una etiqueta por documento
(`src/lib/queries.ts`). El documento público se sirve prerenderizado sin tocar la
base de datos; al guardar en el panel, la acción llama a `updateTag` y el texto
nuevo aparece de inmediato. No hay que reconstruir ni redesplegar para cambiar
una coma.

## Importar desde Word

`scripts/import-tratado.ts` lee el `.docx` original y vuelca su contenido en el
árbol. Tres cosas que no son evidentes y están resueltas ahí:

- **El `.docx` no trae estilos de encabezado.** Los 111 párrafos son estilo
  normal y los títulos solo se distinguen por el formato de sus fragmentos. Por
  eso la estructura va en un **manifiesto explícito** dentro del script: si un
  encabezado no aparece, falla ruidosamente en vez de colgar los párrafos del
  nodo equivocado.
- **Tres encabezados comparten párrafo con su primera frase de cuerpo.** El
  importador corta dentro del párrafo, en la frontera del fragmento donde
  termina el título.
- **Word trocea los subrayados.** Un énfasis puede venir en tres fragmentos con
  un espacio sin marcar en medio; en papel coincide con un salto de línea y no
  se nota, pero en web el texto reflúye y el subrayado saldría roto. El script
  adopta esos espacios huérfanos y fusiona los fragmentos contiguos.

Es idempotente: si el documento ya tiene nodos, no toca nada. Al terminar
imprime un cotejo de nodos y palabras contra el original.

El subrayado es la convención de énfasis de estos documentos, así que está
activado en el editor y se estiliza en salvia despegado de la línea base, para
que nadie lo confunda con un enlace.

## El logotipo

`LogotipoLA.svg` es en realidad un PNG incrustado dentro de un SVG, no vectores.
`scripts/logo-assets.mjs` lo descompone en sus dos capas y genera:

- `public/logo-light.png` — lettering en tinta, para fondo claro
- `public/logo-dark.png` — lettering en crema, para fondo oscuro
- `src/app/icon.png` — la llama sola, favicon

El original queda en `public/logo-original.svg`. Si algún día aparece el archivo
vectorial del diseñador (`.ai`/`.eps`), conviene sustituirlos.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo |
| `npm run build` | Build de producción (necesita `DATABASE_URL`) |
| `npm run db:generate` | Genera una migración a partir del schema |
| `npm run db:migrate` | Aplica las migraciones pendientes (conexión directa) |
| `npm run db:push` | Sincroniza el schema sin migración (solo para probar) |
| `npm run import:tratado` | Importa el tratado desde el `.docx` de `brand/fuentes/` |
| `npm run db:studio` | Explorador visual de la base |

## Despliegue

Vercel. Importa el repo, añade la integración de Neon desde **Storage** (define
`DATABASE_URL` y `DATABASE_URL_UNPOOLED` sola) y define a mano `ADMIN_PASSWORD`
y `SESSION_SECRET`. Activa **Fluid compute**, que es el modo con el que está
configurado el pool.
