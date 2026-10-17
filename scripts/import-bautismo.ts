/**
 * Importa el manual «El Bautismo en agua» desde el .docx original.
 *
 *   npm run import:bautismo
 *
 * Este documento tiene tres particularidades que no tenía el tratado, y las
 * tres están resueltas con listas explícitas en vez de heurísticas:
 *
 * 1. NOTAS AL PIE ESCRITAS COMO PÁRRAFOS SUELTOS. El .docx no usa el mecanismo
 *    de notas de Word: están tecleadas como párrafos normales al pie de cada
 *    página. Peor aún, caen en medio de una frase del cuerpo y la parten en
 *    dos párrafos. Hay que sacarlas y volver a unir lo partido.
 *
 * 2. EJERCICIOS MEZCLADOS CON EL CONTENIDO. No vale la regla fácil de «párrafo
 *    con rayas = ejercicio»: hay enunciados que son contenido real —llevan la
 *    cita bíblica y el texto posterior se apoya en ellos— y hay párrafos que
 *    mezclan pregunta y raya en la misma línea.
 *
 * 3. TRES NIVELES DE JERARQUÍA que cambian de convención según el capítulo:
 *    preguntas sin numerar, romanos y viñetas.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { documents, nodes, type NodeType } from "../src/db/schema";
import {
  countWords,
  joinRuns,
  norm,
  parseDocx,
  toDoc,
  toParagraph,
  type Para,
  type Run,
  type TiptapNode,
} from "./lib-docx";

const SOURCE = "brand/fuentes/manual-bautismo.docx";
const DOC_SLUG = "el-bautismo-en-agua";

/* --------------------------------------------------------------- notas */

/**
 * Dónde está la definición de cada nota. `tail` significa que la nota va
 * pegada al final de un párrafo de cuerpo: se corta en el superíndice.
 */
const NOTES: { n: number; para: number; tail?: boolean }[] = [
  { n: 1, para: 17 },
  { n: 2, para: 45 },
  { n: 3, para: 59 },
  { n: 4, para: 149 },
  { n: 5, para: 161, tail: true },
  { n: 6, para: 175 },
  { n: 7, para: 205 },
];

/**
 * Párrafos que la nota al pie partió en dos. La clave se queda con el texto
 * de su valor y el valor desaparece: «…esta autorizada. No» + «obstante,
 * nosotros no lo practicamos…» vuelve a ser una sola frase.
 */
const REJOIN: Record<number, number> = { 44: 46, 148: 150, 204: 206 };

/* ----------------------------------------------------------- ejercicios */

/**
 * Fuera. Son enunciados de ejercicio, renglones para rellenar, o frases cuya
 * única función era introducir un hueco. Cada decisión, revisada a mano:
 */
const OMIT = new Set([
  76, 77, // «Escribe en este espacio, ¿por qué te quieres bautizar?» + rayas
  88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, // hoja de tarea para el maestro
  117, 118, // «¿Por qué crees que había tal expectativa mesiánica?» + rayas
  124, 125, // «¿Cómo definirías al reino de Dios?» + rayas
  134, // renglones para copiar Juan 1:29
  144, // rayas tras la reflexión sobre el bautismo de Jesús
  160, // renglones para copiar Mateo 28:19
  162, 163, 164, // preguntas sobre la gran comisión + rayas
  168, // «Lee los siguientes pasajes y a continuación responde las preguntas»
  179, 180, 181, 182, 183, // preguntas sobre los pasajes de Hechos + rayas
  244, 246, 250, // rayas de las preguntas sobre los pactos
  262, 263, // «¿Cuál promesa ya ocurrió en tu vida?» + rayas
]);

/**
 * Se quedan, pero sin los renglones. El enunciado es contenido: lleva la cita
 * bíblica y el texto que sigue se apoya en él.
 */
const STRIP_BLANKS = new Set([247]);

/** Se funden en un solo párrafo: el enunciado y su referencia. */
const MERGE: Record<number, number> = { 133: 135 };

/* --------------------------------------------------------- estructura */

type Entry = {
  /** Párrafo del encabezado; `null` para el bloque de apertura, sin título. */
  head: number | null;
  /** Dónde acaba el cuerpo (exclusivo). Si falta, hasta el siguiente. */
  until?: number;
  title: string;
  slug: string;
  type: NodeType;
  parent?: string;
  label?: string;
  numberFormat?: string;
};

const INTRO = "introduccion-al-bautismo";
const AT = "el-bautismo-en-el-antiguo-testamento";
const TRES = "los-tres-bautismos-del-antiguo-testamento";
const NT = "el-bautismo-en-el-nuevo-testamento";
const DOCTRINAL = "el-significado-doctrinal-del-bautismo";
const PASO = "solo-un-paso-de-muchos";
const ASUNTOS = "asuntos-especiales";

const MANIFEST: Entry[] = [
  { head: null, until: 34, title: "Presentación del manual", slug: "presentacion", type: "section", label: "" },

  { head: 34, title: "Introducción al bautismo", slug: INTRO, type: "section", label: "" },
  { head: 35, title: "¿Qué es un sacramento?", slug: "que-es-un-sacramento", type: "article", parent: INTRO, label: "" },
  { head: 41, title: "¿Qué significa la palabra Bautismo?", slug: "que-significa-la-palabra-bautismo", type: "article", parent: INTRO, label: "" },
  { head: 48, title: "¿El bautismo es necesario para nuestra salvación?", slug: "es-el-bautismo-necesario-para-la-salvacion", type: "article", parent: INTRO, label: "" },
  { head: 72, title: "¿Si él bautismo no salva, porque es tan importante?", slug: "si-el-bautismo-no-salva-por-que-es-importante", type: "article", parent: INTRO, label: "" },
  { head: 75, title: "¿Por qué nos bautizamos?", slug: "por-que-nos-bautizamos", type: "article", parent: INTRO, label: "" },

  { head: 99, title: "El bautismo en el Antiguo Testamento", slug: AT, type: "section", label: "" },
  { head: 100, title: "¿De dónde a dónde abarca el Antiguo Pacto?", slug: "de-donde-a-donde-abarca-el-antiguo-pacto", type: "article", parent: AT, label: "" },
  { head: 103, title: "¿Cuáles son los tres bautismos del Antiguo Testamento?", slug: TRES, type: "article", parent: AT, label: "" },
  { head: 104, title: "El bautismo proselitista", slug: "el-bautismo-proselitista", type: "clause", parent: TRES, numberFormat: "{R}." },
  { head: 110, title: "El bautismo de Juan", slug: "el-bautismo-de-juan", type: "clause", parent: TRES, numberFormat: "{R}." },
  { head: 140, title: "El bautismo de Jesús", slug: "el-bautismo-de-jesus", type: "clause", parent: TRES, numberFormat: "{R}." },
  { head: 152, title: "¿Es el bautismo de los cristianos como estos bautismos?", slug: "es-el-bautismo-cristiano-como-estos", type: "article", parent: AT, label: "" },

  { head: 154, title: "El bautismo en el Nuevo Testamento", slug: NT, type: "section", label: "" },
  { head: 166, title: "El bautismo en Hechos", slug: "el-bautismo-en-hechos", type: "article", parent: NT, numberFormat: "{R}." },
  { head: 195, title: "El significado doctrinal del bautismo\u2077", slug: DOCTRINAL, type: "article", parent: NT, numberFormat: "{R}." },
  { head: 198, title: "El bautismo en el Espíritu Santo y el bautismo en agua", slug: "bautismo-en-el-espiritu-santo-y-en-agua", type: "clause", parent: DOCTRINAL, numberFormat: "•" },
  { head: 217, title: "El bautismo como símbolo de identificación", slug: "el-bautismo-como-simbolo-de-identificacion", type: "clause", parent: DOCTRINAL, numberFormat: "•" },
  { head: 238, title: "El bautismo como señal de un pacto", slug: "el-bautismo-como-senal-de-un-pacto", type: "clause", parent: DOCTRINAL, numberFormat: "•" },
  { head: 271, title: "El bautismo como testimonio a tres reinos", slug: "el-bautismo-como-testimonio-a-tres-reinos", type: "clause", parent: DOCTRINAL, numberFormat: "•" },
  { head: 277, title: "Solo un paso de muchos", slug: PASO, type: "article", parent: NT, numberFormat: "{R}." },
  { head: 287, title: "Galatas 5:16–26", slug: "galatas-5-16-26", type: "clause", parent: PASO, label: "" },

  { head: 289, title: "Asuntos especiales", slug: ASUNTOS, type: "section", label: "" },
  { head: 291, title: "¿Puede alguien bautizarse dos veces?", slug: "puede-alguien-bautizarse-dos-veces", type: "article", parent: ASUNTOS, label: "" },
  { head: 293, title: "¿Quién puede bautizar a otro?", slug: "quien-puede-bautizar-a-otro", type: "article", parent: ASUNTOS, label: "" },
  { head: 295, title: "¿En qué lugar debemos ser bautizados?", slug: "en-que-lugar-debemos-ser-bautizados", type: "article", parent: ASUNTOS, label: "" },
  { head: 297, title: "¿Es él bautismo infantil herético?", slug: "es-el-bautismo-infantil-heretico", type: "article", parent: ASUNTOS, label: "" },
  { head: 299, title: "¿Si fui bautizado de niño debo volver a bautizarme?", slug: "si-fui-bautizado-de-nino-debo-volver-a-bautizarme", type: "article", parent: ASUNTOS, label: "" },
  { head: 303, title: "¿Es él bautismo por los muertos una práctica bíblica?", slug: "es-el-bautismo-por-los-muertos-biblico", type: "article", parent: ASUNTOS, label: "" },

  { head: 306, title: "Himno", slug: "himno", type: "section", label: "" },
];

/* ------------------------------------------------------------- import */

/** Separa las marcas de nota del cuerpo y devuelve el texto de la nota. */
function splitNote(para: Para): { body: Run[]; note: Run[] } {
  const at = para.runs.findIndex((r) => r.marks.includes("superscript"));
  if (at === -1) return { body: para.runs, note: [] };
  return { body: para.runs.slice(0, at), note: para.runs.slice(at + 1) };
}

/**
 * Quita los renglones para rellenar y la puntuación que los seguía: el
 * original dice «¿…incondicionales? ______________.» y sin limpiar el punto
 * quedaría un «?  .» suelto.
 */
const stripBlanks = (runs: Run[]): Run[] =>
  runs
    .map((r) => ({
      ...r,
      text: r.text
        .replace(/_{3,}\s*[.;,:]?/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([.;,:?!])/g, "$1"),
    }))
    .filter((r) => r.text.trim());

async function main() {
  const paras = parseDocx(SOURCE);
  console.log(`· ${SOURCE}: ${paras.length} párrafos\n`);

  const already = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(eq(nodes.documentSlug, DOC_SLUG))
    .limit(1);
  if (already.length) {
    console.log(`· ${DOC_SLUG} ya tiene contenido. No se toca nada.`);
    process.exit(0);
  }

  // 1. Comprobar que el manifiesto cuadra con el documento.
  for (const entry of MANIFEST) {
    if (entry.head === null) continue;
    const found = norm(paras[entry.head]?.text ?? "");
    // El título puede llevar la llamada a nota en superíndice Unicode; al
    // cotejar con el .docx, donde es un fragmento aparte, se descuenta.
    const want = norm(entry.title)
      .replace(/[\u2070-\u209f]/g, "")
      .toUpperCase()
      .replace(/[.¿?]/g, "");
    const got = found.toUpperCase().replace(/^[IVX]+\.\s*|^[•\-]\s*/, "").replace(/[.¿?]/g, "");
    if (!got.startsWith(want.slice(0, 22))) {
      throw new Error(
        `El párrafo ${entry.head} no es «${entry.title}» sino «${found.slice(0, 70)}». ` +
          `El manifiesto y el .docx no coinciden.`,
      );
    }
  }
  console.log(`✓ los ${MANIFEST.length - 1} encabezados del manifiesto cuadran`);

  // 2. Extraer las notas.
  const notes = new Map<number, Run[]>();
  const noteParas = new Set<number>();
  for (const { n, para, tail } of NOTES) {
    const { note } = splitNote(paras[para]);
    if (!note.length) throw new Error(`La nota ${n} no está en el párrafo ${para}.`);
    notes.set(n, note);
    if (!tail) noteParas.add(para);
  }
  console.log(`✓ ${notes.size} notas extraídas`);

  // 3. Repartir los párrafos entre los nodos.
  const heads = MANIFEST.map((e) => e.head).filter((h): h is number => h !== null);
  const bodies = new Map<string, TiptapNode[]>();
  const used = new Set<number>();

  for (const entry of MANIFEST) {
    const from = entry.head === null ? 2 : entry.head + 1;
    const to =
      entry.until ?? heads.find((h) => h > (entry.head ?? -1)) ?? paras.length;
    const blocks: TiptapNode[] = [];

    for (let i = from; i < to; i++) {
      if (OMIT.has(i) || used.has(i)) continue;
      if (noteParas.has(i)) continue;

      let runs =
        NOTES.some((x) => x.para === i && x.tail)
          ? splitNote(paras[i]).body
          : paras[i].runs;

      if (REJOIN[i] !== undefined) {
        runs = joinRuns(runs, paras[REJOIN[i]].runs);
        used.add(REJOIN[i]);
      }
      if (MERGE[i] !== undefined) {
        runs = [...runs, { text: " ", marks: [] }, ...paras[MERGE[i]].runs];
        used.add(MERGE[i]);
      }
      if (STRIP_BLANKS.has(i)) runs = stripBlanks(runs);

      const p = toParagraph(runs);
      if (p) blocks.push(p);
    }
    bodies.set(entry.slug, blocks);
  }

  // 4. Escribir.
  const titleP = norm(paras[0].text).replace(/[“”"]/g, "");
  await db
    .insert(documents)
    .values({
      slug: DOC_SLUG,
      title: "El Bautismo en agua",
      subtitle: titleP.replace(/^El Bautismo en agua\.?\s*/i, "").trim(),
      byline: "Pr. Patricio Huitron G.",
      position: 3,
    })
    .onConflictDoNothing();

  const ids = new Map<string, string>();
  const pos = new Map<string, number>();
  const nextPos = (key: string) => {
    const n = pos.get(key) ?? 0;
    pos.set(key, n + 1);
    return n;
  };

  for (const entry of MANIFEST) {
    const parentId = entry.parent ? (ids.get(entry.parent) ?? null) : null;
    const [row] = await db
      .insert(nodes)
      .values({
        documentSlug: DOC_SLUG,
        parentId,
        type: entry.type,
        position: nextPos(entry.parent ?? "@root"),
        label: entry.label ?? null,
        numberFormat: entry.numberFormat ?? null,
        title: entry.title,
        slug: entry.slug,
        body: toDoc(bodies.get(entry.slug) ?? []) as never,
      })
      .returning({ id: nodes.id });
    ids.set(entry.slug, row.id);
  }

  // Las notas, al final, en su propio apartado.
  const noteBlocks: TiptapNode[] = [];
  for (const { n } of NOTES) {
    const runs: Run[] = [
      { text: String(n), marks: ["superscript"] },
      { text: " ", marks: [] },
      ...notes.get(n)!,
    ];
    const p = toParagraph(runs);
    if (p) noteBlocks.push(p);
  }
  await db.insert(nodes).values({
    documentSlug: DOC_SLUG,
    parentId: null,
    type: "section",
    position: nextPos("@root"),
    label: "",
    title: "Notas",
    slug: "notas",
    body: toDoc(noteBlocks) as never,
  });

  // 5. Cotejo.
  const words = (ns: TiptapNode[]) => ns.reduce((a, b) => a + countWords(b), 0);
  const imported = [...bodies.values()].reduce((a, b) => a + words(b), 0) + words(noteBlocks);
  const source = paras.reduce((n, p) => n + norm(p.text).split(/\s+/).filter(Boolean).length, 0);
  const omitted = [...OMIT].reduce((n, i) => n + norm(paras[i].text).split(/\s+/).filter(Boolean).length, 0);
  const headWords = MANIFEST.filter((e) => e.head !== null)
    .reduce((n, e) => n + norm(paras[e.head!].text).split(/\s+/).filter(Boolean).length, 0);
  const sup = paras.reduce((n, p) => n + p.runs.filter((r) => r.marks.includes("superscript")).length, 0);

  console.log(`
  nodos creados        ${MANIFEST.length + 1}
  palabras importadas  ${imported}
  + encabezados        ${headWords}
  + ejercicios fuera   ${omitted}
  + portada            ${source - imported - headWords - omitted}
  = origen             ${source}

  notas                ${notes.size}
  superíndices         ${sup} fragmentos
  párrafos recompuestos ${Object.keys(REJOIN).length}
  apartados sin rótulo ${MANIFEST.filter((e) => e.label === "").length + 1}
`);
  process.exit(0);
}

main().catch((error) => {
  console.error("\n✖", error instanceof Error ? error.message : error);
  process.exit(1);
});
