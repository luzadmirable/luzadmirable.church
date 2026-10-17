/** Lectura de .docx: párrafos, fragmentos y sus marcas. */
import { execFileSync } from "node:child_process";

export type Mark = "bold" | "italic" | "underline" | "superscript";
export type Run = { text: string; marks: Mark[] };
export type Para = { runs: Run[]; text: string };

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

export function parseDocx(file: string): Para[] {
  const xml = execFileSync("unzip", ["-p", file, "word/document.xml"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
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
      if (/<w:vertAlign w:val="superscript"\s*\/?>/.test(props))
        marks.push("superscript");
      runs.push({ text, marks });
    }

    // Word parte los fragmentos de forma arbitraria: un énfasis puede venir en
    // varios trozos con un espacio sin marcar en medio. En papel coincide con
    // un salto de línea y no se nota; en web el texto reflúye y saldría roto.
    // Primero se adopta ese espacio huérfano, luego se fusiona lo contiguo.
    for (let i = 1; i < runs.length - 1; i++) {
      if (runs[i].text.trim()) continue;
      const a = runs[i - 1].marks;
      const b = runs[i + 1].marks;
      if (a.length && a.length === b.length && a.every((m) => b.includes(m))) {
        runs[i].marks = [...a];
      }
    }
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

/**
 * Une dos mitades de una frase que el salto de página partió. Mete un espacio
 * si ninguna de las dos lo trae: sin esto, «…no provee» + «para los suyos»
 * sale como «proveepara».
 */
export function joinRuns(a: Run[], b: Run[]): Run[] {
  if (!a.length || !b.length) return [...a, ...b];
  const needsSpace = !/\s$/.test(a.at(-1)!.text) && !/^\s/.test(b[0].text);
  return needsSpace ? [...a, { text: " ", marks: [] }, ...b] : [...a, ...b];
}

export const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export type TiptapNode = Record<string, unknown>;

export function toParagraph(runs: Run[]): TiptapNode | null {
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

export const toDoc = (blocks: TiptapNode[]) =>
  blocks.length ? { type: "doc", content: blocks } : null;

export function countWords(block: TiptapNode): number {
  const content = block.content as TiptapNode[] | undefined;
  if (!content) return 0;
  return content.reduce((n, child) => {
    if (child.type === "text") {
      return n + String(child.text).split(/\s+/).filter(Boolean).length;
    }
    return n + countWords(child);
  }, 0);
}
