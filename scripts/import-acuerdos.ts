/**
 * Importa «Acuerdos y distintivos doctrinales» desde el .docx original.
 *
 *   npm run import:acuerdos
 *
 * Lo propio de este documento:
 *
 * 1. ES NORMATIVO DE VERDAD: trece artículos en romanos, que es justo para lo
 *    que se diseñó el modelo. Van como apartados con plantilla «Artículo {R}».
 *
 * 2. SUS NOTAS SIGUEN LA NUMERACIÓN DEL DOCUMENTO DE MEMBRESÍA: empiezan en la
 *    18 y llegan a la 34. Los dos documentos comparten una sola serie.
 *
 * 3. LA NOTA 18 NO ES UNA NOTA AL PIE. Dice «NOTA EDITORIAL SOBRE ESTOS
 *    DISTINTIVOS» y habla del documento entero; está numerada como nota solo
 *    por la maqueta. Va al principio, como preámbulo, donde se lee.
 *
 * 4. CINCO FRASES PARTIDAS por el salto de página, una de ellas con tres
 *    párrafos de notas de por medio.
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

const SOURCE = "brand/fuentes/acuerdos-y-distintivos.docx";
const DOC_SLUG = "acuerdos-y-distintivos-doctrinales";

/** Párrafos con definiciones de nota. Algunos guardan varias. */
const NOTE_PARAS = [26, 27, 47, 48, 70, 98, 100, 109, 110, 111, 116, 117, 147];
/** El preámbulo, numerado como nota 18 solo por la maqueta. */
const PREAMBLE = 3;

/** Frases que el salto de página partió en dos. */
const REJOIN: Record<number, number> = {
  8: 9,
  108: 112,
  167: 168,
  211: 212,
  219: 220,
};

type Entry = {
  head: number;
  until: number;
  title: string;
  slug: string;
  type: NodeType;
  label?: string;
  numberFormat?: string;
};

/** Cada artículo lleva dos párrafos de encabezado: «ARTÍCULO N» y el título.
 *  `head` es el del título; el del ordinal queda fuera porque el rótulo lo
 *  regenera la plantilla. */
const ART: [number, number, string, string][] = [
  [5, 28, "Las Escrituras y la confesión histórica de fe", "las-escrituras-y-la-confesion-historica-de-fe"],
  [29, 59, "La predicación expositiva", "la-predicacion-expositiva"],
  [60, 71, "La teología del pacto", "la-teologia-del-pacto"],
  [72, 89, "La ley y el evangelio", "la-ley-y-el-evangelio"],
  [90, 101, "El día del Señor²⁴", "el-dia-del-senor"],
  [102, 118, "Sacramentos²⁶", "sacramentos"],
  [119, 136, "Gobierno de la iglesia", "gobierno-de-la-iglesia"],
  [137, 149, "Servicio en la iglesia", "servicio-en-la-iglesia"],
  [150, 159, "Dones espirituales", "dones-espirituales"],
  [160, 172, "Disciplina eclesiástica", "disciplina-eclesiastica"],
  [173, 195, "Diezmos, ofrendas y administración", "diezmos-ofrendas-y-administracion"],
  [196, 213, "El orden de la familia", "el-orden-de-la-familia"],
  [214, 224, "La iglesia ante el gobierno", "la-iglesia-ante-el-gobierno"],
];

const MANIFEST: Entry[] = ART.map(([head, until, title, slug]) => ({
  head,
  until,
  title,
  slug,
  type: "section" as NodeType,
  numberFormat: "Artículo {R}",
}));

/** Separa un párrafo de notas en una por cada superíndice que lo encabeza. */
function splitNotes(para: Para): { n: string; runs: Run[] }[] {
  const out: { n: string; runs: Run[] }[] = [];
  for (const run of para.runs) {
    if (run.marks.includes("superscript") && /^\d+\s*$/.test(run.text.trim())) {
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

  for (const e of MANIFEST) {
    const found = norm(paras[e.head]?.text ?? "");
    const want = norm(e.title).replace(/[²¹⁰-₟]/g, "").toUpperCase();
    if (!found.toUpperCase().startsWith(want.slice(0, 22))) {
      throw new Error(`El párrafo ${e.head} no es «${e.title}» sino «${found.slice(0, 70)}».`);
    }
  }
  console.log(`✓ los ${MANIFEST.length} artículos del manifiesto cuadran`);

  const noteSet = new Set(NOTE_PARAS);
  const notes = NOTE_PARAS.flatMap((i) => splitNotes(paras[i]));
  console.log(`✓ ${notes.length} notas extraídas de ${NOTE_PARAS.length} párrafos`);

  const bodies = new Map<string, TiptapNode[]>();
  const used = new Set<number>();
  for (const e of MANIFEST) {
    const blocks: TiptapNode[] = [];
    for (let i = e.head + 1; i < e.until; i++) {
      if (noteSet.has(i) || used.has(i)) continue;
      let runs = paras[i].runs;
      if (REJOIN[i] !== undefined) {
        runs = joinRuns(runs, paras[REJOIN[i]].runs);
        used.add(REJOIN[i]);
      }
      const p = toParagraph(runs);
      if (p) blocks.push(p);
    }
    bodies.set(e.slug, blocks);
  }

  await db
    .insert(documents)
    .values({
      slug: DOC_SLUG,
      title: "Acuerdos y distintivos doctrinales",
      byline: "Patricio Huitron G. · Pastor y Maestro",
      position: 1,
    })
    .onConflictDoNothing();

  let pos = 0;

  // El preámbulo, sin su número de nota.
  const pre = paras[PREAMBLE].runs.filter((r) => !r.marks.includes("superscript"));
  await db.insert(nodes).values({
    documentSlug: DOC_SLUG,
    parentId: null,
    type: "section",
    position: pos++,
    label: "",
    title: "Nota editorial",
    slug: "nota-editorial",
    body: toDoc([toParagraph(pre)!]) as never,
  });

  for (const e of MANIFEST) {
    await db.insert(nodes).values({
      documentSlug: DOC_SLUG,
      parentId: null,
      type: e.type,
      position: pos++,
      label: null,
      numberFormat: e.numberFormat ?? null,
      title: e.title,
      slug: e.slug,
      body: toDoc(bodies.get(e.slug) ?? []) as never,
    });
  }

  const noteBlocks = notes
    .map(({ n, runs }) =>
      toParagraph([{ text: n, marks: ["superscript"] }, { text: " ", marks: [] }, ...runs]),
    )
    .filter((b): b is TiptapNode => b !== null);

  await db.insert(nodes).values({
    documentSlug: DOC_SLUG,
    parentId: null,
    type: "section",
    position: pos++,
    label: "",
    title: "Notas",
    slug: "notas",
    body: toDoc(noteBlocks) as never,
  });

  const words = (ns: TiptapNode[]) => ns.reduce((a, b) => a + countWords(b), 0);
  const imported =
    [...bodies.values()].reduce((a, b) => a + words(b), 0) +
    words(noteBlocks) +
    countWords(toParagraph(pre)!);
  const source = paras.reduce((n, p) => n + norm(p.text).split(/\s+/).filter(Boolean).length, 0);

  console.log(`
  nodos creados         ${MANIFEST.length + 2}
  palabras importadas   ${imported} de ${source} en el origen
  artículos             ${MANIFEST.length}
  notas                 ${notes.length}  (19–34; la 18 es el preámbulo)
  párrafos recompuestos ${Object.keys(REJOIN).length}
`);
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
