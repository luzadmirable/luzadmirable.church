/**
 * Importa el «Glosario de términos y conceptos» desde el .docx original.
 *
 *   npm run import:glosario
 *
 * A diferencia de los otros documentos, aquí la estructura es perfectamente
 * regular: una letra sola, y debajo pares de término en negrita y definición
 * en redonda. Por eso se deriva en vez de listarse a mano — 77 términos
 * escritos a mano serían más frágiles que la regla.
 *
 * Lo que la hace segura son las aserciones: si un término se queda sin
 * definición, si una letra se queda sin términos o si el abecedario se
 * desordena, esto falla y no escribe nada.
 *
 * Los términos van como `clause` a propósito: así el índice del documento
 * queda como un abecedario —que es como se indexa un glosario— y no como una
 * lista de setenta y siete entradas.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { documents, nodes } from "../src/db/schema";
import { slugify, uniqueSlug } from "../src/lib/slug";
import {
  countWords,
  norm,
  parseDocx,
  toDoc,
  toParagraph,
  type Para,

} from "./lib-docx";

const SOURCE = "brand/fuentes/glosario.docx";
const DOC_SLUG = "glosario-de-terminos";

/** El título ocupa los dos primeros párrafos; el cuerpo empieza después. */
const FIRST = 2;

const isBold = (p: Para) =>
  p.runs.length > 0 && p.runs.every((r) => !r.text.trim() || r.marks.includes("bold"));

type Term = { term: string; definition: Para };
type Letter = { letter: string; terms: Term[] };

function readGlossary(paras: Para[]): Letter[] {
  const letters: Letter[] = [];
  let i = FIRST;

  while (i < paras.length) {
    const t = norm(paras[i].text);
    if (!t) {
      i++;
      continue;
    }

    // Una letra sola abre un bloque.
    if (/^[A-ZÁÉÍÓÚÑ]$/.test(t)) {
      letters.push({ letter: t, terms: [] });
      i++;
      continue;
    }

    if (!letters.length) {
      throw new Error(`El párrafo ${i} («${t.slice(0, 50)}») aparece antes de la primera letra.`);
    }
    if (!isBold(paras[i])) {
      throw new Error(
        `El párrafo ${i} («${t.slice(0, 50)}») debería ser un término en negrita.`,
      );
    }

    // Tras el término, su definición: el siguiente párrafo con texto.
    let j = i + 1;
    while (j < paras.length && !norm(paras[j].text)) j++;
    if (j >= paras.length) {
      throw new Error(`El término «${t}» (párrafo ${i}) se quedó sin definición.`);
    }
    if (isBold(paras[j])) {
      throw new Error(
        `El término «${t}» (párrafo ${i}) va seguido de otro término en negrita, no de una definición.`,
      );
    }
    letters.at(-1)!.terms.push({ term: t, definition: paras[j] });
    i = j + 1;
  }

  for (const l of letters) {
    if (!l.terms.length) throw new Error(`La letra ${l.letter} se quedó sin términos.`);
  }
  const order = letters.map((l) => l.letter);
  const sorted = [...order].sort((a, b) => a.localeCompare(b, "es"));
  if (order.join("") !== sorted.join("")) {
    throw new Error(`Las letras no vienen en orden: ${order.join(" ")}`);
  }
  return letters;
}

async function main() {
  const paras = parseDocx(SOURCE);
  const letters = readGlossary(paras);
  const total = letters.reduce((n, l) => n + l.terms.length, 0);
  console.log(`· ${SOURCE}: ${paras.length} párrafos`);
  console.log(`✓ ${letters.length} letras · ${total} términos · todas las definiciones presentes`);
  console.log(`  ${letters.map((l) => `${l.letter}(${l.terms.length})`).join(" ")}\n`);

  const already = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(eq(nodes.documentSlug, DOC_SLUG))
    .limit(1);
  if (already.length) {
    console.log(`· ${DOC_SLUG} ya tiene contenido. No se toca nada.`);
    process.exit(0);
  }

  await db
    .insert(documents)
    .values({
      slug: DOC_SLUG,
      title: "Glosario de términos y conceptos",
      subtitle:
        "Vocabulario de los documentos normativos de la iglesia, ordenado alfabéticamente.",
      position: 4,
    })
    .onConflictDoNothing();

  const taken = new Set<string>();
  let rootPos = 0;
  let imported = 0;

  for (const { letter, terms } of letters) {
    const letterSlug = uniqueSlug(`letra-${slugify(letter)}`, taken);
    const [row] = await db
      .insert(nodes)
      .values({
        documentSlug: DOC_SLUG,
        parentId: null,
        type: "section",
        position: rootPos++,
        label: "",
        title: letter,
        slug: letterSlug,
        body: null,
      })
      .returning({ id: nodes.id });

    let pos = 0;
    for (const { term, definition } of terms) {
      const body = toParagraph(definition.runs);
      await db.insert(nodes).values({
        documentSlug: DOC_SLUG,
        parentId: row.id,
        type: "clause",
        position: pos++,
        label: "",
        title: term,
        slug: uniqueSlug(slugify(term), taken),
        body: toDoc(body ? [body] : []) as never,
      });
      if (body) imported += countWords(body);
    }
  }

  const source = paras.reduce(
    (n, p) => n + norm(p.text).split(/\s+/).filter(Boolean).length,
    0,
  );
  const termWords = letters.reduce(
    (n, l) => n + l.terms.reduce((m, t) => m + t.term.split(/\s+/).length, 0),
    0,
  );
  console.log(`
  nodos creados        ${letters.length + total}
  letras               ${letters.length}
  términos             ${total}
  palabras definición  ${imported}
  + términos           ${termWords}
  + letras y portada   ${source - imported - termWords}
  = origen             ${source}
`);
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
