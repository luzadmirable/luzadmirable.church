import Link from "next/link";
import { createNodeForm, moveNodeForm } from "@/actions/forms";
import type { TreeNode } from "@/lib/tree";

const TYPE_NAME = {
  section: "Capítulo",
  article: "Artículo",
  clause: "Inciso",
} as const;

export function NodeTree({
  tree,
  documentSlug,
  selectedId,
}: {
  tree: TreeNode[];
  documentSlug: string;
  selectedId?: string;
}) {
  return (
    <div className="flex flex-col">
      {tree.length === 0 ? (
        <p className="px-3 py-6 text-sm text-ink-faint">
          Documento vacío. Empieza por un capítulo.
        </p>
      ) : (
        tree.map((node, index) => (
          <Row
            key={node.id}
            node={node}
            documentSlug={documentSlug}
            selectedId={selectedId}
            isFirst={index === 0}
            isLast={index === tree.length - 1}
          />
        ))
      )}
      <AddButtons documentSlug={documentSlug} parentId={null} types={["section", "article"]} />
    </div>
  );
}

function Row({
  node,
  documentSlug,
  selectedId,
  isFirst,
  isLast,
}: {
  node: TreeNode;
  documentSlug: string;
  selectedId?: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const selected = node.id === selectedId;
  const childTypes: Array<keyof typeof TYPE_NAME> =
    node.type === "section" ? ["section", "article"] : ["clause"];

  return (
    <div>
      <div
        className={`group flex items-center gap-1 border-l-2 py-1.5 pr-1 ${
          selected
            ? "border-accent bg-accent-soft"
            : "border-transparent hover:bg-surface-2"
        }`}
        style={{ paddingLeft: `${0.5 + node.depth * 0.85}rem` }}
      >
        <Link
          href={`/admin/${documentSlug}?nodo=${node.id}`}
          className="min-w-0 flex-1 truncate font-util text-sm"
        >
          <span className="text-ink-faint">{node.resolvedLabel}</span>{" "}
          <span className={selected ? "text-ink" : "text-ink-soft"}>
            {node.title || "(sin título)"}
          </span>
        </Link>

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <MoveButton id={node.id} direction="up" disabled={isFirst} />
          <MoveButton id={node.id} direction="down" disabled={isLast} />
        </div>
      </div>

      {node.children.map((child, index) => (
        <Row
          key={child.id}
          node={child}
          documentSlug={documentSlug}
          selectedId={selectedId}
          isFirst={index === 0}
          isLast={index === node.children.length - 1}
        />
      ))}

      {selected ? (
        <div style={{ paddingLeft: `${1 + node.depth * 0.85}rem` }}>
          <AddButtons
            documentSlug={documentSlug}
            parentId={node.id}
            types={childTypes}
          />
        </div>
      ) : null}
    </div>
  );
}

function MoveButton({
  id,
  direction,
  disabled,
}: {
  id: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moveNodeForm}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={direction === "up" ? "Subir" : "Bajar"}
        className="px-1.5 py-0.5 font-util text-xs text-ink-faint hover:text-accent disabled:opacity-25 disabled:hover:text-ink-faint"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

function AddButtons({
  documentSlug,
  parentId,
  types,
}: {
  documentSlug: string;
  parentId: string | null;
  types: Array<keyof typeof TYPE_NAME>;
}) {
  return (
    <div className="flex flex-wrap gap-2 px-2 py-2">
      {types.map((type) => (
        <form key={type} action={createNodeForm}>
          <input type="hidden" name="documentSlug" value={documentSlug} />
          <input type="hidden" name="parentId" value={parentId ?? ""} />
          <input type="hidden" name="type" value={type} />
          <button
            type="submit"
            className="label-util border border-rule px-2 py-1 text-[0.62rem] text-ink-faint transition-colors hover:border-accent hover:text-accent"
          >
            + {TYPE_NAME[type]}
          </button>
        </form>
      ))}
    </div>
  );
}
