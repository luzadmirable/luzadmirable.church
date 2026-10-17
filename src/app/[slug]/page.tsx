import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DocumentOutline } from "@/components/DocumentOutline";
import { DocumentSections } from "@/components/DocumentSections";
import { BrandTab } from "@/components/BrandTab";
import { StuckPins } from "@/components/StuckPins";
import { getDocument, getDocumentTree } from "@/lib/queries";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const doc = await getDocument((await params).slug);
  if (!doc) return {};
  return { title: doc.title, description: doc.subtitle ?? undefined };
}

export default function DocumentPage({ params }: Params) {
  // La cabecera se prerenderiza; el documento llega en cuanto se resuelve el
  // slug. Sin esta frontera, leer `params` bloquearía toda la página.
  return (
    <>
      <BrandTab />
      <main className="doc-column py-14">
        <Suspense fallback={<DocumentSkeleton />}>
          <DocumentContents params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function DocumentContents({ params }: Params) {
  const { slug } = await params;
  const doc = await getDocument(slug);
  if (!doc) notFound();

  const tree = await getDocumentTree(slug);

  return (
    <>
      <header className="page-enter">
        <h1 className="title-xl text-[1.85rem] text-balance text-ink sm:text-[2.4rem]">
          {doc.title}
        </h1>
        {doc.subtitle ? (
          <p className="font-sub mt-3 text-lg leading-relaxed text-ink-soft italic">
            {doc.subtitle}
          </p>
        ) : null}
        {doc.byline ? (
          <p className="label-caps mt-4 text-[0.74rem] text-sage-deep">
            {doc.byline}
          </p>
        ) : null}
      </header>

      <div className="mt-10">
        <DocumentOutline tree={tree} />
      </div>

      <div className="mt-12">
        <DocumentSections tree={tree} />
      </div>

      {/* Dentro de la frontera de Suspense, no fuera: su efecto debe correr
          cuando este subárbol ya está hidratado. Montado fuera, marcaba los
          rótulos mientras React todavía los hidrataba y React encontraba
          atributos que él no había puesto. */}
      <StuckPins />
    </>
  );
}

function DocumentSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
      <div className="h-8 w-2/3 bg-surface-2" />
      <div className="h-4 w-1/2 bg-surface-2" />
      <div className="mt-8 h-40 w-full bg-surface-2" />
    </div>
  );
}
