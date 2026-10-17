/**
 * Importa «La Confesión Bautista de Fe de Londres de 1689».
 *
 *   npm run import:confesion
 *
 * El texto de 1689 es de dominio público; esta traducción al español es de
 * Ministerios Ligonier y se reproduce con atribución en la portadilla del
 * documento. La página original queda guardada en brand/fuentes para que la
 * importación sea reproducible y no dependa de que su sitio siga en pie.
 *
 * La estructura es regular y por eso se deriva en vez de listarse a mano: un
 * párrafo con <strong> abre capítulo, un párrafo que empieza por «N.» abre
 * artículo, y cualquier otro continúa el artículo en curso. Esa última regla
 * es la que recoge la lista del canon del capítulo 1, que viene partida en
 * varios párrafos, y el «Todos los cuales…» que la cierra.
 *
 * Lo que la hace segura son las aserciones: si aparece un capítulo de más o
 * de menos, si la numeración de un capítulo se salta un artículo, o si el
 * canon no suma 66 libros, esto falla y no escribe nada.
 */
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { documents, nodes } from "../src/db/schema";
import { slugify, uniqueSlug } from "../src/lib/slug";
import { countWords, norm, toDoc, type TiptapNode } from "./lib-docx";

const SOURCE = "brand/fuentes/confesion-1689.html";
const DOC_SLUG = "confesion-de-londres-1689";

/** Capítulos que trae la Confesión. Si no son exactamente estos, algo cambió. */
const CAPITULOS = 32;

/**
 * El canon, en el orden de la Confesión.
 *
 * La página de Ligonier maqueta los 66 libros en columnas, y al extraer el
 * texto se leen en un orden que no es el impreso: Daniel y los profetas
 * menores se adelantan a Cantar de los Cantares e Isaías. En pantalla se ve
 * bien; es un artefacto de la extracción. Reproducir el canon desordenado en
 * un documento doctrinal sí sería un error, así que el orden se restituye
 * desde aquí y se comprueba contra lo extraído: mismos libros, sin faltar ni
 * sobrar ninguno. La ortografía es la de la fuente, con sus I/1 mezclados.
 */
const ANTIGUO = [
  "Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio", "Josué", "Jueces",
  "Ruth", "I Samuel", "II Samuel", "I Reyes", "II Reyes", "I Crónicas",
  "II Crónicas", "Esdras", "Nehemías", "Ester", "Job", "Salmos", "Proverbios",
  "Eclesiastés", "Cantar de los Cantares", "Isaías", "Jeremías",
  "Lamentaciones", "Ezequiel", "Daniel", "Oseas", "Joel", "Amós", "Abdías",
  "Jonás", "Miqueas", "Nahum", "Habacuc", "Sofonías", "Hageo", "Zacarías",
  "Malaquías",
];
const NUEVO = [
  "Mateo", "Marcos", "Lucas", "Juan", "Hechos de los Apóstoles", "Romanos",
  "I Corintios", "II Corintios", "Gálatas", "Efesios", "Filipenses",
  "Colosenses", "I Tesalonicenses", "II Tesalonicenses", "I Timoteo",
  "II Timoteo", "Tito", "Filemón", "Hebreos", "Santiago", "1 Pedro",
  "2 Pedro", "1 Juan", "2 Juan", "3 Juan", "Judas", "Apocalipsis",
];

// ---------------------------------------------------------------- extracción

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  mdash: "—", ndash: "–", hellip: "…",
};

function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) {
      return String.fromCodePoint(parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) return String.fromCodePoint(parseInt(name.slice(1), 10));
    return ENTITIES[name] ?? whole;
  });
}

/** Quita las etiquetas de un fragmento y normaliza los espacios. */
const strip = (s: string) => norm(decode(s.replace(/<[^>]+>/g, "")));

/** Igual, pero los <br> se vuelven saltos: así se leen las listas de libros. */
function stripLines(s: string): string[] {
  return decode(s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((l) => norm(l))
    .filter(Boolean);
}

type Articulo = { numero: number; parrafos: string[] };
type Capitulo = { numero: number; titulo: string; articulos: Articulo[] };

/** «Capítulo Uno» → 1 · «CAPÍTULO 2» → 2 */
function numeroDeCapitulo(marca: string): number {
  const digits = marca.match(/\d+/);
  if (digits) return Number(digits[0]);
  if (/\buno\b/i.test(marca)) return 1;
  throw new Error(`No se puede leer el número del capítulo en «${marca}».`);
}

function leer(html: string): Capitulo[] {
  const crudos = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  const capitulos: Capitulo[] = [];

  for (const crudo of crudos) {
    // Cabecera de capítulo: el rótulo en <strong> y el título detrás.
    const marca = crudo.match(/<strong>([\s\S]*?)<\/strong>/);
    if (marca) {
      const titulo = strip(crudo.slice(crudo.indexOf("</strong>") + 9));
      if (!titulo) throw new Error(`El capítulo «${strip(marca[1])}» no trae título.`);
      capitulos.push({ numero: numeroDeCapitulo(strip(marca[1])), titulo, articulos: [] });
      continue;
    }

    const lineas = stripLines(crudo);
    if (!lineas.length) continue;

    const actual = capitulos.at(-1);
    // Pasado el último capítulo viene el pie del sitio: ahí se corta.
    if (!actual) continue;
    if (capitulos.length === CAPITULOS && esPie(lineas)) break;

    // Un párrafo que empieza por «N.» abre artículo; cualquier otro continúa
    // el que esté abierto. Esa segunda regla recoge la lista del canon.
    const abre = lineas[0].match(/^(\d+)\.\s+(.*)$/);
    if (abre && lineas.length === 1) {
      actual.articulos.push({ numero: Number(abre[1]), parrafos: [abre[2]] });
      continue;
    }

    const articulo = actual.articulos.at(-1);
    if (!articulo) {
      throw new Error(
        `El capítulo ${actual.numero} empieza con un párrafo sin número: «${lineas[0].slice(0, 60)}».`,
      );
    }
    articulo.parrafos.push(...lineas);
  }

  return capitulos;
}

/** El pie de Ligonier: no es parte de la Confesión. */
const esPie = (lineas: string[]) =>
  lineas.some((l) => /Ligonier|@es\.ligonier\.org|Sanford, FL/.test(l));

function comprobar(capitulos: Capitulo[]) {
  if (capitulos.length !== CAPITULOS) {
    throw new Error(`Se esperaban ${CAPITULOS} capítulos y se encontraron ${capitulos.length}.`);
  }
  capitulos.forEach((c, i) => {
    if (c.numero !== i + 1) {
      throw new Error(`El capítulo en la posición ${i + 1} dice ser el ${c.numero}.`);
    }
    if (!c.articulos.length) throw new Error(`El capítulo ${c.numero} se quedó sin artículos.`);
    c.articulos.forEach((a, j) => {
      if (a.numero !== j + 1) {
        throw new Error(
          `En el capítulo ${c.numero}, el artículo en la posición ${j + 1} dice ser el ${a.numero}.`,
        );
      }
    });
  });
}

/**
 * Sustituye la lista del canon por la del orden correcto.
 *
 * Se busca por contenido, no por posición: los libros son los párrafos que
 * coinciden exactamente con un nombre de la lista. Si lo encontrado no es el
 * mismo conjunto de 66, esto falla antes de escribir nada.
 */
function restituirCanon(capitulos: Capitulo[]) {
  const canon = [...ANTIGUO, ...NUEVO];
  const esLibro = new Set(canon);
  const articulo = capitulos[0].articulos[1];
  if (!articulo) throw new Error("El capítulo 1 no tiene un artículo 2 donde buscar el canon.");

  const encontrados = articulo.parrafos.filter((p) => esLibro.has(p));
  if (encontrados.length !== canon.length) {
    const faltan = canon.filter((l) => !encontrados.includes(l));
    throw new Error(
      `El canon debería traer ${canon.length} libros y se encontraron ${encontrados.length}.` +
        (faltan.length ? `\n  No aparecen: ${faltan.join(", ")}` : ""),
    );
  }

  const antes = articulo.parrafos.findIndex((p) => esLibro.has(p));
  const resto = articulo.parrafos.filter((p) => !esLibro.has(p));
  articulo.parrafos = [
    ...resto.slice(0, antes),
    ANTIGUO.join(" · "),
    NUEVO.join(" · "),
    ...resto.slice(antes),
  ];
}

// ----------------------------------------------------------------- escritura

const parrafo = (text: string): TiptapNode => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

async function main() {
  const html = readFileSync(SOURCE, "utf8");
  const capitulos = leer(html);
  comprobar(capitulos);
  restituirCanon(capitulos);

  const totalArticulos = capitulos.reduce((n, c) => n + c.articulos.length, 0);
  console.log(`· ${SOURCE}`);
  console.log(`✓ ${CAPITULOS} capítulos · ${totalArticulos} artículos · canon de 66 libros\n`);

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
      title: "La Confesión Bautista de Fe de Londres de 1689",
      subtitle:
        "Confesión histórica de las iglesias bautistas reformadas, en treinta y dos capítulos.",
      byline: "Traducción de Ministerios Ligonier.",
      position: 5,
    })
    .onConflictDoNothing();

  const taken = new Set<string>();
  let rootPos = 0;
  let palabras = 0;

  for (const capitulo of capitulos) {
    const [row] = await db
      .insert(nodes)
      .values({
        documentSlug: DOC_SLUG,
        parentId: null,
        type: "section",
        position: rootPos++,
        label: null,
        numberFormat: "Capítulo {n}",
        title: capitulo.titulo,
        slug: uniqueSlug(slugify(capitulo.titulo), taken),
        body: null,
      })
      .returning({ id: nodes.id });

    let pos = 0;
    for (const articulo of capitulo.articulos) {
      const bloques = articulo.parrafos.map(parrafo);
      await db.insert(nodes).values({
        documentSlug: DOC_SLUG,
        parentId: row.id,
        type: "article",
        position: pos++,
        label: null,
        numberFormat: "{n}.",
        title: "",
        slug: uniqueSlug(`capitulo-${capitulo.numero}-${articulo.numero}`, taken),
        body: toDoc(bloques) as never,
      });
      palabras += bloques.reduce((n, b) => n + countWords(b), 0);
    }
  }

  const tituloPalabras = capitulos.reduce(
    (n, c) => n + c.titulo.split(/\s+/).filter(Boolean).length,
    0,
  );

  console.log(`
  nodos creados        ${CAPITULOS + totalArticulos}
  capítulos            ${CAPITULOS}
  artículos            ${totalArticulos}
  palabras de cuerpo   ${palabras}
  + títulos            ${tituloPalabras}
  = total              ${palabras + tituloPalabras}
`);
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
