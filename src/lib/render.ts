import "server-only";
import { generateHTML } from "@tiptap/html/server";
import type { JSONContent } from "@tiptap/react";
import { editorExtensions } from "./editor";

/** Convierte el jsonb de Tiptap en HTML para el documento público. */
export function renderBody(body: JSONContent | null): string {
  if (!body || !body.content?.length) return "";
  return generateHTML(body, editorExtensions);
}

export function isEmptyBody(body: JSONContent | null): boolean {
  if (!body?.content?.length) return true;
  return !generateHTML(body, editorExtensions).replace(/<[^>]*>|\s|&nbsp;/g, "");
}
