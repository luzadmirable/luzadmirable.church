/**
 * Importa el tratado «Misión, Visión y Servicio» desde el .docx original.
 *
 *   npm run import:tratado
 *
 * El .docx no trae estilos de encabezado ni numeración de Word: los 111
 * párrafos son estilo normal y los títulos solo se distinguen por el formato
 * de sus fragmentos. Por eso la estructura va en un manifiesto explícito —
 * cualquier heurística se equivocaría en silencio. Si un encabezado del
 * manifiesto no aparece en el documento, esto falla ruidosamente.
 *
 * Es idempotente: si el documento ya tiene nodos, no toca nada.
 */
import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { documents, nodes, type NodeType } from "../src/db/schema";
import { slugify } from "../src/lib/slug";

const SOURCE = "brand/fuentes/tratado-mision-vision-servicio.docx";
const DOC_SLUG = "mision-vision-servicio";

/* ---------------------------------------------------------------- parser */

type Mark = "bold" | "italic" | "underline";
type Run = { text: string; marks: Mark[] };
type Para = { runs: Run[]; text: string };

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Word marca «desactivado» con val="0"/"false"/"none", no quitando la etiqueta. */
function markOn(props: string, tag: string): boolean {
  const m = props.match(new RegExp(`<w:${tag}(\\s[^>]*)?/?>`));
  if (!m) return false;
  const val = m[0].match(/w:val="([^"]*)"/)?.[1];
  return val !== "0" && val !== "false" && val !== "none";
}

function parseDocx(file: string): Para[] {
  const xml = execFileSync("unzip", ["-p", file, "word/document.xml"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  const paras: Para[] = [];
  for (const [, pXml] of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const runs: Run[] = [];
    for (const [, rXml] of pXml.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
      const text = [...rXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((m) => unescape(m[1]))
        .join("");
      if (!text) continue;
      const props = rXml.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? "";
      const marks: Mark[] = [];
      if (markOn(props, "b")) marks.push("bold");
      if (markOn(props, "i")) marks.push("italic");
      if (markOn(props, "u")) marks.push("underline");
      runs.push({ text, marks });
    }
    // Word parte los fragmentos de forma arbitraria: un subrayado puede venir
    // en tres trozos con un espacio sin marcar en medio. En papel no se nota
    // porque cae en un salto de línea, pero en web el texto reflúye y el
    // subrayado saldría roto. Primero se adopta ese espacio huérfano.
    for (let i = 1; i < runs.length - 1; i++) {
      if (runs[i].text.trim()) continue;
      const a = runs[i - 1].marks;
      const b = runs[i + 1].marks;
      if (a.length && a.length === b.length && a.every((m) => b.includes(m))) {
        runs[i].marks = [...a];
      }
    }
    // Y luego se fusionan los contiguos con las mismas marcas.
    const merged: Run[] = [];
    for (const run of runs) {
      const prev = merged.at(-1);
      const same =
        prev &&
        prev.marks.length === run.marks.length &&
        prev.marks.every((m) => run.marks.includes(m));
      if (same) prev.text += run.text;
      else merged.push({ ...run });
    }
    paras.push({ runs: merged, text: merged.map((r) => r.text).join("") });
  }
  return paras;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/* ------------------------------------------------------------- manifiesto */

type Entry = {
  /** Texto del encabezado tal como aparece en el .docx. */
  heading: string;
  type: NodeType;
  /** Slug del padre; sin esto cuelga de la raíz. */
  parent?: string;
  /** "" = sin rótulo. */
  label?: string;
  numberFormat?: string;
};

const SERVICIO = "sobre-el-servicio-en-la-iglesia";

const PRINCIPIOS = [
  "I. EL SERVICIO NO ES MAS IMPORTANTE QUE DIOS:",
  "II. EL SERVICIO DEBE GIRAR EN TORNO A LA PALABRA DE DIOS",
  "III. EL SERVICIO ES ADORACIÓN A DIOS",
  "IV. EL SERVICIO ES PARA EL PROJIMO",
  "V. EL SERVICIO ES HUMILDE",
  "VI. EL SERVICIO DEBE SER DECOROSO",
  "VII. EL SERVICIO REQUIERE ESFUERZO",
  "VIII. EL SERVICIO DEBE MOSTRAR LOS ATRIBUTOS DE DIOS",
  "IX. EL SERVICIO DEBE SER RESPETUOSO DE OTRO SERVICIO",
  "X. EL SERVICIO NO ES DE TU PROPIEDAD",
  "XI. EL SERVICIO ES EVANGELISTICO",
  "XII. EL SERVICIO NO ES PARA LA GLORIA DE LA IGLESIA LOCAL.",
];

const MANIFEST: Entry[] = [
  { heading: "SOBRE LA ESENCIA DE LA IGLESIA.", type: "section", label: "" },
  { heading: "SOBRE LA MISIÓN DE LA IGLESIA.", type: "section", label: "" },
  { heading: "SOBRE LA VISION DE LA IGLESIA", type: "section", label: "" },
  { heading: "SOBRE EL SERVICIO EN LA IGLESIA", type: "section", label: "" },
  ...PRINCIPIOS.map(
    (heading): Entry => ({
      heading,
      type: "article",
      parent: SERVICIO,
      numberFormat: "{R}.",
    }),
  ),
  { heading: "CONCLUSIÓN", type: "section", label: "" },
];

/** Quita el ordinal romano y la puntuación final; no toca las palabras. */
const cleanTitle = (heading: string) =>
  heading.replace(/^[IVX]+\.\s*/, "").replace(/[.:]\s*$/, "");

/* ------------------------------------------------------------- conversión */

type TiptapNode = Record<string, unknown>;

function toParagraph(runs: Run[]): TiptapNode | null {
  const content = runs
    .filter((r) => r.text.length > 0)
    .map((r) => ({
      type: "text",
      text: r.text,
      ...(r.marks.length ? { marks: r.marks.map((type) => ({ type })) } : {}),
    }));
  if (!content.length) return null;
  return { type: "paragraph", content };
}

const toDoc = (blocks: TiptapNode[]) =>
  blocks.length ? { type: "doc", content: blocks } : null;

/* ---------------------------------------------------------------- import */

async function main() {
  const paras = parseDocx(SOURCE);
  console.log(`· ${SOURCE}: ${paras.length} párrafos`);

  const existing = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(eq(nodes.documentSlug, DOC_SLUG))
    .limit(1);
  if (existing.length) {
    console.log(`· ${DOC_SLUG} ya tiene contenido. No se toca nada.`);
    process.exit(0);
  }

  // 1. Localizar cada encabezado del manifiesto y, si viene pegado al cuerpo,
  //    anotar en qué fragmento hay que cortar.
  type Found = Entry & { paraIndex: number; runIndex: number; title: string };
  const found: Found[] = [];
  let cursor = 0;

  for (const entry of MANIFEST) {
    const want = norm(entry.heading);
    let hit = -1;
    let runIndex = 0;

    for (let i = cursor; i < paras.length; i++) {
      if (!norm(paras[i].text).startsWith(want)) continue;
      // ¿Dónde termina el encabezado dentro del párrafo?
      let acc = "";
      for (let r = 0; r < paras[i].runs.length; r++) {
        acc += paras[i].runs[r].text;
        if (norm(acc).length >= want.length) {
          runIndex = r + 1;
          break;
        }
      }
      hit = i;
      break;
    }

    if (hit === -1) {
      throw new Error(
        `No encontré el encabezado «${entry.heading}» a partir del párrafo ${cursor}. ` +
          `El manifiesto y el .docx no coinciden; revísalo antes de importar.`,
      );
    }
    found.push({ ...entry, paraIndex: hit, runIndex, title: cleanTitle(entry.heading) });
    cursor = hit + 1;
  }

  // 2. Repartir los párrafos: cada nodo se queda con lo que va hasta el
  //    siguiente encabezado, más la cola de su propio párrafo si venía pegada.
  const bodies = new Map<number, TiptapNode[]>();
  found.forEach((f, idx) => {
    const blocks: TiptapNode[] = [];
    const tail = paras[f.paraIndex].runs.slice(f.runIndex);
    const tailPara = toParagraph(tail);
    if (tailPara) blocks.push(tailPara);

    const end = idx + 1 < found.length ? found[idx + 1].paraIndex : paras.length;
    for (let i = f.paraIndex + 1; i < end; i++) {
      const p = toParagraph(paras[i].runs);
      if (p) blocks.push(p);
    }
    bodies.set(idx, blocks);
  });

  // 3. Cabecera del documento: título, subtítulo, autoría y epígrafe.
  const [, titleP, subtitleP, bylineP, ...rest] = paras;
  const epigraphParas = rest.slice(0, found[0].paraIndex - 4);

  await db
    .insert(documents)
    .values({
      slug: DOC_SLUG,
      title: norm(titleP.text).replace(/^[“"]|[”"]$/g, ""),
      subtitle: norm(subtitleP.text),
      byline: norm(bylineP.text).replace(" / ", " · "),
      position: 2,
    })
    .onConflictDoNothing();

  const taken = new Set<string>();
  const uniqueSlug = (base: string) => {
    let slug = base || "apartado";
    let n = 2;
    while (taken.has(slug)) slug = `${base}-${n++}`;
    taken.add(slug);
    return slug;
  };

  const ids = new Map<string, string>();
  let rootPos = 0;
  const childPos = new Map<string, number>();
  let created = 0;

  // El epígrafe: sección sin rótulo ni título, con el texto en cita.
  if (epigraphParas.length) {
    const quote = {
      type: "blockquote",
      content: epigraphParas.map((p) => toParagraph(p.runs)).filter(Boolean),
    };
    const slug = uniqueSlug("epigrafe");
    await db.insert(nodes).values({
      documentSlug: DOC_SLUG,
      parentId: null,
      type: "section",
      position: rootPos++,
      label: "",
      title: "",
      slug,
      body: toDoc([quote]) as never,
    });
    created++;
  }

  for (const [idx, f] of found.entries()) {
    const slug = uniqueSlug(slugify(f.title));
    const parentId = f.parent ? (ids.get(f.parent) ?? null) : null;
    const position = f.parent
      ? (childPos.set(f.parent, (childPos.get(f.parent) ?? 0) + 1),
        childPos.get(f.parent)! - 1)
      : rootPos++;

    const [row] = await db
      .insert(nodes)
      .values({
        documentSlug: DOC_SLUG,
        parentId,
        type: f.type,
        position,
        label: f.label ?? null,
        numberFormat: f.numberFormat ?? null,
        title: f.title,
        slug,
        body: toDoc(bodies.get(idx) ?? []) as never,
      })
      .returning({ id: nodes.id });

    ids.set(slug, row.id);
    created++;
  }

  // 4. Cotejo contra el original.
  const sourceWords = paras.reduce((n, p) => n + norm(p.text).split(/\s+/).filter(Boolean).length, 0);
  const importedWords = [...bodies.values()]
    .flat()
    .concat(epigraphParas.map((p) => toParagraph(p.runs)!).filter(Boolean))
    .reduce((n, block) => n + countWords(block), 0);
  const headingWords = found.reduce((n, f) => n + norm(f.heading).split(/\s+/).length, 0);
  const underlines = paras.reduce(
    (n, p) => n + p.runs.filter((r) => r.marks.includes("underline")).length,
    0,
  );

  console.log(`
  nodos creados        ${created}  (esperados ${MANIFEST.length + 1})
  palabras en cuerpo   ${importedWords}
  + encabezados        ${headingWords}
  + portada            ${sourceWords - importedWords - headingWords}
  = origen             ${sourceWords}
  subrayados           ${underlines} fragmentos en el .docx
  sin rótulo           ${found.filter((f) => f.label === "").length + 1} apartados
`);
  process.exit(0);
}

function countWords(block: TiptapNode): number {
  const content = block.content as TiptapNode[] | undefined;
  if (!content) return 0;
  return content.reduce((n, child) => {
    if (child.type === "text") {
      return n + String(child.text).split(/\s+/).filter(Boolean).length;
    }
    return n + countWords(child);
  }, 0);
}

main().catch((error) => {
  console.error("\n✖", error instanceof Error ? error.message : error);
  process.exit(1);
});
