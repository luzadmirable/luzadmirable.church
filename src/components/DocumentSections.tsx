import { Reveal } from "@/components/Reveal";
import { renderBody } from "@/lib/render";
import type { TreeNode } from "@/lib/tree";

/* Margen de anclaje: la barra es fija, así que un enlace citado debe parar
   por debajo de ella y no quedarse tapado. */
const ANCHOR = "scroll-mt-28";

export function DocumentSections({ tree }: { tree: TreeNode[] }) {
  if (tree.length === 0) {
    return (
      <p className="py-12 text-center text-ink-faint">
        Este documento todavía no tiene contenido.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-11">
      {tree.map((node) => (
        <Node key={node.id} node={node} />
      ))}
    </div>
  );
}

function Node({ node }: { node: TreeNode }) {
  // El HTML sale de Tiptap con un esquema cerrado (negrita, itálica, listas)
  // y lo escribe el liderazgo desde /admin, no un visitante.
  const html = renderBody(node.body);

  if (node.type === "section") {
    return (
      <section id={node.slug} className={`${ANCHOR} flex flex-col gap-6`}>
        {/* Sin envoltorio animado encima: un ancestro con `transform` rompe
            el `sticky` de este rótulo. */}
        {/* Un apartado puede no llevar ni rótulo ni título — el epígrafe del
            tratado es solo una cita. En ese caso no se fija nada arriba. */}
        {node.resolvedLabel || node.title ? (
          <div className="chapter-pin border-t-2 border-ink">
            {node.resolvedLabel ? (
              <p className="kicker text-[0.92rem] text-accent">
                {node.resolvedLabel}
              </p>
            ) : null}
            {node.title ? (
              <h2 className="title-lg text-[1.4rem] text-balance text-ink sm:text-[1.6rem]">
                {node.title}
              </h2>
            ) : null}
          </div>
        ) : null}
        {html ? (
          <Reveal>
            <div
              className="doc-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </Reveal>
        ) : null}
        {node.children.length > 0 ? (
          <div className="flex flex-col gap-7">
            {node.children.map((child) => (
              <Node key={child.id} node={child} />
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  if (node.type === "article") {
    return (
      <article id={node.slug} className={ANCHOR}>
        <h3 className="text-reveal flex flex-wrap items-baseline gap-x-2.5">
          {node.resolvedLabel ? (
            <a
              href={`#${node.slug}`}
              className="label-caps text-[0.73rem] text-ink-faint transition-colors hover:text-accent"
              aria-label={`Enlace a ${node.resolvedLabel}`}
            >
              {node.resolvedLabel}
            </a>
          ) : null}
          <span className="font-sub text-lg font-extrabold text-ink">
            {node.title}
          </span>
        </h3>
        {html ? (
          <Reveal>
            <div
              className="doc-body mt-2"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </Reveal>
        ) : null}
        {node.children.length > 0 ? (
          <div className="mt-3.5 flex flex-col gap-3">
            {node.children.map((child) => (
              <Node key={child.id} node={child} />
            ))}
          </div>
        ) : null}
      </article>
    );
  }

  // Inciso: el rótulo cuelga a la izquierda del texto.
  return (
    <div id={node.slug} className={`${ANCHOR} flex gap-3 pl-1`}>
      {node.resolvedLabel ? (
        <span className="label-caps mt-0.5 shrink-0 text-[0.72rem] text-sage-deep tabular-nums">
          {node.resolvedLabel}
        </span>
      ) : null}
      <div className="min-w-0">
        {node.title ? (
          <p className="font-sub font-bold text-ink">{node.title}</p>
        ) : null}
        {html ? (
          <div className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />
        ) : null}
      </div>
    </div>
  );
}
