import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { longDate } from "@/lib/format";
import { listDocuments } from "@/lib/queries";

// Ruta tras sesión: se renderiza siempre en el servidor, no se prerenderiza.
export const instant = false;

export default async function AdminHomePage() {
  await requireSession();
  const documents = await listDocuments();

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="label-caps text-xl text-ink">Documentos</h1>

      {documents.length === 0 ? (
        <p className="mt-8 border border-rule bg-surface p-5 text-sm text-ink-soft">
          No hay documentos todavía. Ejecuta{" "}
          <code className="text-accent">npm run db:seed</code> para crear el de
          membresía y el de bases doctrinales.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col border-t border-rule">
          {documents.map((doc) => (
            <li key={doc.slug} className="border-b border-rule">
              <Link
                href={`/admin/${doc.slug}`}
                className="group flex items-baseline justify-between gap-4 py-5 transition-colors hover:bg-surface"
              >
                <span>
                  <span className="label-caps text-base text-ink group-hover:text-accent">
                    {doc.title}
                  </span>
                  {doc.subtitle ? (
                    <span className="mt-1 block font-body text-sm text-ink-soft">
                      {doc.subtitle}
                    </span>
                  ) : null}
                </span>
                <span className="label-util shrink-0 text-[0.62rem] text-ink-faint">
                  {longDate(doc.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
