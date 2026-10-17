/**
 * Importa «La membresía de la iglesia» desde el .docx original.
 *
 *   npm run import:membresia
 *
 * Lo propio de este documento:
 *
 * 1. DIECISIETE NOTAS AL PIE, tecleadas como párrafos sueltos igual que en el
 *    manual del bautismo — pero aquí hay párrafos que guardan VARIAS: el de la
 *    página 2 lleva las notas 2, 3 y 4 seguidas. Hay que partirlo por cada
 *    superíndice.
 *
 * 2. PÁRRAFOS PARTIDOS POR EL SALTO DE PÁGINA, no solo por las notas. Dos de
 *    los tres cortes no tienen nota en medio: simplemente la frase cruzaba de
 *    página y Word la guardó como dos párrafos.
 *
 * 3. EL CREDO NICENO en treinta versos. Esos saltos SÍ son intencionales y hay
 *    que conservarlos: es un texto que se recita, no un párrafo que reflúye.
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

const SOURCE = "brand/fuentes/manual-membresia.docx";
const DOC_SLUG = "la-membresia-de-la-iglesia";

/** Párrafos que contienen definiciones de nota. Algunos guardan varias. */
const NOTE_PARAS = [16, 27, 47, 48, 54, 99, 108, 109, 110, 111, 123, 150, 158, 170];

/**
 * Frases que el salto de página partió en dos párrafos. La clave absorbe el
 * texto de su valor. En el caso de p46 hay además dos notas en medio, que ya
 * salen por su cuenta.
 */
const REJOIN: Record<number, number> = { 21: 22, 46: 49, 129: 130 };

/** El Credo Niceno: treinta versos que se conservan línea a línea, en cita. */
const CREED: [number, number] = [58, 87];

type Entry = {
  head: number | null;
  until?: number;
  title: string;
  slug: string;
  type: NodeType;
  parent?: string;
  label?: string;
  numberFormat?: string;
};

const ENCONTRAR = "que-debo-encontrar-en-una-iglesia";
const BENEFICIOS = "que-beneficios-hay-de-unirme-a-la-iglesia-local";

const MANIFEST: Entry[] = [
  { head: 6, title: "¿Qué es la iglesia?¹", slug: "que-es-la-iglesia", type: "section", label: "" },
  { head: 11, title: "¿Qué es la membresía de la iglesia?", slug: "que-es-la-membresia-de-la-iglesia", type: "section", label: "" },
  { head: 39, title: "Fundamento bíblico de la membresía", slug: "fundamento-biblico-de-la-membresia", type: "section", label: "" },

  { head: 55, title: "¿Qué debo encontrar en una iglesia para hacerme miembro de ella?", slug: ENCONTRAR, type: "section", label: "" },
  { head: 57, title: "Confesión y sostenimiento del Credo Niceno Constantinopolitano", slug: "credo-niceno-constantinopolitano", type: "article", parent: ENCONTRAR, numberFormat: "{R}." },
  { head: 88, title: "Un evangelio ortodoxo, ortopático y ortopráctico", slug: "un-evangelio-ortodoxo-ortopatico-y-ortopractico", type: "article", parent: ENCONTRAR, numberFormat: "{R}." },
  { head: 100, title: "La predicación expositiva", slug: "la-predicacion-expositiva", type: "article", parent: ENCONTRAR, numberFormat: "{R}." },
  { head: 104, title: "La administración de los sacramentos¹¹", slug: "la-administracion-de-los-sacramentos", type: "article", parent: ENCONTRAR, numberFormat: "{R}." },

  { head: 124, title: "¿Qué beneficios hay de unirme a la iglesia local como miembro?", slug: BENEFICIOS, type: "section", label: "" },
  { head: 126, title: "Un alimento espiritual sólido, sistemático y congruente", slug: "un-alimento-espiritual-solido", type: "article", parent: BENEFICIOS, numberFormat: "{R}." },
  { head: 132, title: "Seguridad para crecer en la fe", slug: "seguridad-para-crecer-en-la-fe", type: "article", parent: BENEFICIOS, numberFormat: "{R}." },
  { head: 137, title: "Una potencia evangelizadora", slug: "una-potencia-evangelizadora", type: "article", parent: BENEFICIOS, numberFormat: "{R}." },
  { head: 140, title: "Una base de defensa del evangelio", slug: "una-base-de-defensa-del-evangelio", type: "article", parent: BENEFICIOS, numberFormat: "{R}." },
  { head: 145, title: "Para la edificación efectiva de la iglesia", slug: "para-la-edificacion-efectiva-de-la-iglesia", type: "article", parent: BENEFICIOS, numberFormat: "{R}." },
  { head: 154, title: "Para glorificar a Dios en nuestra unidad", slug: "para-glorificar-a-dios-en-nuestra-unidad", type: "article", parent: BENEFICIOS, numberFormat: "{R}." },

  { head: 159, title: "¿Qué se requiere para ser miembro de Luz Admirable?", slug: "que-se-requiere-para-ser-miembro", type: "section", label: "" },
];

/** Separa un párrafo de notas en una por cada superíndice que lo encabeza. */
function splitNotes(para: Para): { n: string; runs: Run[] }[] {
  const out: { n: string; runs: Run[] }[] = [];
  for (const run of para.runs) {
    if (run.marks.includes("superscript") && /^\d/.test(run.text.trim())) {
      out.push({ n: run.text.trim(), runs: [] });
    } else if (out.length) {
      out.at(-1)!.runs.push(run);
    }
  }
  return out.filter((x) => x.runs.some((r) => r.text.trim()));
}

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

  for (const entry of MANIFEST) {
    if (entry.head === null) continue;
    const found = norm(paras[entry.head]?.text ?? "");
    const want = norm(entry.title)
      .replace(/[¹²³⁰-₟]/g, "")
      .toUpperCase()
      .replace(/[.,:¿?]/g, "");
    const got = found
      .toUpperCase()
      .replace(/^[IVX]+\.\s*/, "")
      .replace(/^LA MEMBRESÍA DE LA IGLESIA\.?\s*/, "")
      .replace(/[.,:¿?]/g, "");
    if (!got.startsWith(want.slice(0, 24))) {
      throw new Error(
        `El párrafo ${entry.head} no es «${entry.title}» sino «${found.slice(0, 70)}».`,
      );
    }
  }
  console.log(`✓ los ${MANIFEST.length} encabezados del manifiesto cuadran`);

  const noteSet = new Set(NOTE_PARAS);
  const notes: { n: string; runs: Run[] }[] = [];
  for (const i of NOTE_PARAS) notes.push(...splitNotes(paras[i]));
  console.log(`✓ ${notes.length} notas extraídas de ${NOTE_PARAS.length} párrafos`);

  const heads = MANIFEST.map((e) => e.head).filter((h): h is number => h !== null);
  const bodies = new Map<string, TiptapNode[]>();
  const used = new Set<number>();

  for (const entry of MANIFEST) {
    const from = entry.head === null ? 0 : entry.head + 1;
    const to = entry.until ?? heads.find((h) => h > (entry.head ?? -1)) ?? paras.length;
    const blocks: TiptapNode[] = [];
    const creed: TiptapNode[] = [];

    for (let i = from; i < to; i++) {
      if (noteSet.has(i) || used.has(i)) continue;

      let runs = paras[i].runs;
      if (REJOIN[i] !== undefined) {
        runs = joinRuns(runs, paras[REJOIN[i]].runs);
        used.add(REJOIN[i]);
      }
      const p = toParagraph(runs);
      if (!p) continue;

      // Los versos del Credo se agrupan en una sola cita.
      if (i >= CREED[0] && i <= CREED[1]) creed.push(p);
      else blocks.push(p);
    }
    if (creed.length) blocks.push({ type: "blockquote", content: creed });
    bodies.set(entry.slug, blocks);
  }

  await db
    .insert(documents)
    .values({
      slug: DOC_SLUG,
      title: "La membresía de la iglesia",
      subtitle: "Acuerdos y distintivos doctrinales",
      byline: "Patricio Huitron Gómez",
      position: 1,
    })
    .onConflictDoNothing();

  const ids = new Map<string, string>();
  const pos = new Map<string, number>();
  const nextPos = (k: string) => {
    const n = pos.get(k) ?? 0;
    pos.set(k, n + 1);
    return n;
  };

  for (const entry of MANIFEST) {
    const [row] = await db
      .insert(nodes)
      .values({
        documentSlug: DOC_SLUG,
        parentId: entry.parent ? (ids.get(entry.parent) ?? null) : null,
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

  const noteBlocks = notes
    .map(({ n, runs }) =>
      toParagraph([
        { text: n, marks: ["superscript"] },
        { text: " ", marks: [] },
        ...runs,
      ]),
    )
    .filter((b): b is TiptapNode => b !== null);

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

  const words = (ns: TiptapNode[]) => ns.reduce((a, b) => a + countWords(b), 0);
  const imported = [...bodies.values()].reduce((a, b) => a + words(b), 0) + words(noteBlocks);
  const source = paras.reduce((n, p) => n + norm(p.text).split(/\s+/).filter(Boolean).length, 0);
  const sup = paras.reduce((n, p) => n + p.runs.filter((r) => r.marks.includes("superscript")).length, 0);

  console.log(`
  nodos creados         ${MANIFEST.length + 1}
  palabras importadas   ${imported} de ${source} en el origen
  notas                 ${notes.length}
  superíndices          ${sup} fragmentos
  párrafos recompuestos ${Object.keys(REJOIN).length}
  versos del Credo      ${CREED[1] - CREED[0] + 1}
`);
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
