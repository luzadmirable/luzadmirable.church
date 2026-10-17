import Link from "next/link";
import { notFound } from "next/navigation";
import { updateDocumentForm } from "@/actions/forms";
import { NodeForm, type EditableNode } from "@/components/admin/NodeForm";
import { NodeTree } from "@/components/admin/NodeTree";
import { requireSession } from "@/lib/auth";
import { getDocument, getDocumentTree } from "@/lib/queries";
import { flattenTree } from "@/lib/tree";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ nodo?: string }>;
};

// Ruta tras sesión: se renderiza siempre en el servidor, no se prerenderiza.
export const instant = false;

export default async function EditDocumentPage({ params, searchParams }: Props) {
  await requireSession();

  const { slug } = await params;
  const doc = await getDocument(slug);
  if (!doc) notFound();

  const tree = await getDocumentTree(slug);
  const { nodo } = await searchParams;
  const selected = flattenTree(tree).find((node) => node.id === nodo);

  const editable: EditableNode | null = selected
    ? {
        id: selected.id,
        type: selected.type,
        title: selected.title,
        label: selected.label,
        numberFormat: selected.numberFormat,
        slug: selected.slug,
        body: selected.body,
        resolvedLabel: selected.resolvedLabel,
      }
    : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="label-caps text-lg text-ink">{doc.title}</h1>
        <Link
          href={`/${doc.slug}`}
          className="label-util text-[0.66rem] text-ink-faint hover:text-accent"
        >
          Ver el documento publicado
        </Link>
      </div>

      <form
        action={updateDocumentForm}
        className="mt-6 grid items-end gap-3 border border-rule bg-surface p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <input type="hidden" name="slug" value={doc.slug} />
        <label className="flex flex-col gap-1.5">
          <span className="label-util text-[0.64rem] text-ink-faint">
            Título del documento
          </span>
          <input
            name="title"
            defaultValue={doc.title}
            required
            className="border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-util text-[0.64rem] text-ink-faint">
            Subtítulo
          </span>
          <input
            name="subtitle"
            defaultValue={doc.subtitle ?? ""}
            placeholder="opcional"
            className="border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-util text-[0.64rem] text-ink-faint">
            Autoría
          </span>
          <input
            name="byline"
            defaultValue={doc.byline ?? ""}
            placeholder="Pr. Nombre · Mes Año"
            className="border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="label-util border border-rule px-3 py-2.5 text-[0.66rem] text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          Guardar
        </button>
      </form>

      <div className="mt-8 grid gap-8 lg:grid-cols-[19rem_1fr] lg:items-start">
        <aside className="border border-rule bg-surface lg:sticky lg:top-6">
          <p className="label-util border-b border-rule px-3 py-2.5 text-[0.64rem] text-ink-faint">
            Estructura
          </p>
          <NodeTree tree={tree} documentSlug={doc.slug} selectedId={nodo} />
        </aside>

        <section>
          {editable ? (
            // El formulario se remonta al cambiar de apartado.
            <NodeForm key={editable.id} node={editable} documentSlug={doc.slug} />
          ) : (
            <p className="border border-dashed border-rule bg-surface-2 px-5 py-16 text-center text-sm text-ink-faint">
              Elige un apartado de la estructura para editar su texto, o crea uno
              nuevo.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
