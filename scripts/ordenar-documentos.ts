/**
 * Fija el orden en que los documentos aparecen en la portada.
 *
 *   npm run ordenar
 *
 * El panel de administración edita el contenido de cada documento, pero no el
 * orden entre ellos: es una decisión editorial que se toma de tarde en tarde y
 * que conviene que quede escrita y versionada, no arrastrada con el ratón.
 *
 * La lista de abajo es la fuente de verdad. Las aserciones garantizan que no
 * sobre ni falte ninguno, así que no se puede dejar un documento fuera de la
 * portada por olvidar añadirlo aquí.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { documents } from "../src/db/schema";

const ORDEN = [
  "mision-vision-servicio",
  "la-membresia-de-la-iglesia",
  "acuerdos-y-distintivos-doctrinales",
  "el-bautismo-en-agua",
  "glosario-de-terminos",
];

async function main() {
  const actuales = await db
    .select({ slug: documents.slug, title: documents.title })
    .from(documents);

  const enBase = new Set(actuales.map((d) => d.slug));
  const faltan = ORDEN.filter((s) => !enBase.has(s));
  const sobran = [...enBase].filter((s) => !ORDEN.includes(s));

  if (faltan.length) throw new Error(`No existen en la base: ${faltan.join(", ")}`);
  if (sobran.length)
    throw new Error(
      `Documentos sin lugar asignado: ${sobran.join(", ")}\n` +
        "  Añádelos a ORDEN para decidir dónde van.",
    );

  const titulo = new Map(actuales.map((d) => [d.slug, d.title]));

  for (const [i, slug] of ORDEN.entries()) {
    await db.update(documents).set({ position: i }).where(eq(documents.slug, slug));
    console.log(`  ${i + 1}. ${titulo.get(slug)}`);
  }

  console.log(`\n✔ ${ORDEN.length} documentos ordenados.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
