import { BrandNav } from "./BrandNav";
import { listDocuments } from "@/lib/queries";

/** Lee los documentos en el servidor y se los pasa al panel. */
export async function BrandTab({ splash = false }: { splash?: boolean }) {
  const documents = await listDocuments();
  return (
    <BrandNav
      splash={splash}
      documents={documents.map((d) => ({ slug: d.slug, title: d.title }))}
    />
  );
}
