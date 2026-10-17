import type { NodeRow, NodeType } from "@/db/schema";

export type TreeNode = NodeRow & {
  children: TreeNode[];
  /** Rótulo ya resuelto. Cadena vacía = este nodo no lleva rótulo. */
  resolvedLabel: string;
  depth: number;
};

/** Convención por defecto cuando el nodo no trae plantilla propia. */
export const DEFAULT_FORMAT: Record<NodeType, string> = {
  section: "Capítulo {R}",
  article: "Artículo {n}",
  clause: "{a})",
};

const ROMAN: [number, string][] = [
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function roman(n: number): string {
  let out = "";
  let rest = n;
  for (const [value, numeral] of ROMAN) {
    while (rest >= value) {
      out += numeral;
      rest -= value;
    }
  }
  return out;
}

function letter(n: number): string {
  // 1 → a, 27 → aa
  let out = "";
  let rest = n;
  while (rest > 0) {
    const mod = (rest - 1) % 26;
    out = String.fromCharCode(97 + mod) + out;
    rest = Math.floor((rest - mod) / 26);
  }
  return out;
}

/** Sustituye las fichas de la plantilla por el contador que toca. */
export function applyFormat(format: string, count: number): string {
  return format
    .replace(/\{R\}/g, roman(count))
    .replace(/\{n\}/g, String(count))
    .replace(/\{a\}/g, letter(count));
}

/**
 * Convierte las filas planas en un árbol y resuelve la numeración.
 *
 * Los capítulos y los incisos se cuentan entre hermanos; los artículos llevan
 * un contador corrido por todo el documento, no por capítulo — así se cita un
 * documento normativo. La forma del rótulo la decide `numberFormat`, de modo
 * que un tratado puede numerar sus principios en romanos sin tocar código.
 */
export function buildTree(rows: NodeRow[]): TreeNode[] {
  const byParent = new Map<string | null, NodeRow[]>();
  for (const row of rows) {
    const key = row.parentId;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(row);
    else byParent.set(key, [row]);
  }
  for (const bucket of byParent.values()) {
    bucket.sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug));
  }

  let articleCount = 0;

  function walk(parentId: string | null, depth: number): TreeNode[] {
    const siblings = byParent.get(parentId) ?? [];
    // Contadores locales, uno por cada convención en uso entre estos hermanos.
    const local = new Map<string, number>();

    return siblings.map((row) => {
      // Sin rótulo no se consume número: si no, un apartado mudo correría el
      // contador y el siguiente rotulado saldría con la cuenta adelantada.
      if (row.label === "") {
        return {
          ...row,
          depth,
          resolvedLabel: "",
          children: walk(row.id, depth + 1),
        };
      }
      if (row.label?.trim()) {
        return {
          ...row,
          depth,
          resolvedLabel: row.label.trim(),
          children: walk(row.id, depth + 1),
        };
      }

      // Una plantilla propia significa numeración local: los principios de un
      // capítulo empiezan en I aunque otro capítulo ya tenga los suyos. Sin
      // plantilla manda la convención del tipo, y los artículos de un estatuto
      // se cuentan corridos por todo el documento.
      let count: number;
      if (row.numberFormat) {
        const key = `${row.type}:${row.numberFormat}`;
        count = (local.get(key) ?? 0) + 1;
        local.set(key, count);
      } else if (row.type === "article") {
        articleCount += 1;
        count = articleCount;
      } else {
        const key = row.type;
        count = (local.get(key) ?? 0) + 1;
        local.set(key, count);
      }

      return {
        ...row,
        depth,
        resolvedLabel: applyFormat(
          row.numberFormat ?? DEFAULT_FORMAT[row.type],
          count,
        ),
        children: walk(row.id, depth + 1),
      };
    });
  }

  return walk(null, 0);
}

/** Aplana el árbol en orden de lectura. Útil para el índice. */
export function flattenTree(tree: TreeNode[]): TreeNode[] {
  return tree.flatMap((node) => [node, ...flattenTree(node.children)]);
}
