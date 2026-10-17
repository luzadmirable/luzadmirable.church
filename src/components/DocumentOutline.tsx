import type { TreeNode } from "@/lib/tree";

/**
 * Índice del documento. Solo capítulos y artículos; los incisos no entran.
 *
 * Un glosario se indexa por letra, no por entrada: cuando todos los apartados
 * de primer nivel son una sola letra, el índice se dibuja como abecedario en
 * una fila en vez de como lista. Setenta y nueve entradas en vertical no son
 * un índice, son otro documento.
 */
export function DocumentOutline({ tree }: { tree: TreeNode[] }) {
  const entries = collect(tree);
  if (entries.length === 0) return null;

  const isAlphabet =
    tree.length > 4 && tree.every((n) => n.title.trim().length === 1);

  return (
    <nav
      aria-label="Índice del documento"
      className="no-print border-l-[3px] border-sage bg-surface-2 px-5 py-4"
    >
      <p className="label-util mb-3 text-[0.68rem] font-bold text-sage-deep">
        Índice
      </p>

      {isAlphabet ? (
        <ol className="flex flex-wrap gap-1.5">
          {tree.map((node) => (
            <li key={node.id}>
              <a
                href={`#${node.slug}`}
                aria-label={`Términos con ${node.title}`}
                className="title-lg flex size-9 items-center justify-center border border-sage bg-surface text-[0.95rem] text-ink transition-colors hover:border-accent hover:text-accent"
              >
                {node.title}
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {entries.map((node) => (
            <li
              key={node.id}
              style={{ paddingLeft: `${node.depth * 1.15}rem` }}
              className="leading-snug"
            >
              <a
                href={`#${node.slug}`}
                className="group inline-flex flex-wrap items-baseline gap-x-2 transition-colors hover:text-accent"
              >
                {node.resolvedLabel ? (
                  <span
                    className={
                      node.type === "section"
                        ? "label-caps text-[0.72rem] text-sage-deep"
                        : "label-caps text-[0.68rem] text-ink-faint"
                    }
                  >
                    {node.resolvedLabel}
                  </span>
                ) : null}
                <span
                  className={
                    node.type === "section"
                      ? "font-sub text-[0.98rem] font-bold text-ink"
                      : "text-[0.95rem] text-ink-soft"
                  }
                >
                  {node.title}
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}

function collect(tree: TreeNode[]): TreeNode[] {
  return tree.flatMap((node) =>
    node.type === "clause" ? [] : [node, ...collect(node.children)],
  );
}
