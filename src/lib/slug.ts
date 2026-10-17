/** "Artículo 7 — De la Admisión" → "articulo-7-de-la-admision" */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Añade un sufijo numérico si el slug ya está ocupado en el documento. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = base || "apartado";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}
