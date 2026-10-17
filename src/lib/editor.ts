import { Placeholder } from "@tiptap/extensions";
import Superscript from "@tiptap/extension-superscript";
import StarterKit from "@tiptap/starter-kit";

/**
 * Juego mínimo de marcas: negrita, itálica, subrayado, listas y citas. Nada de
 * títulos ni bloques de código — la jerarquía del documento la da el árbol, no
 * el editor, y así nadie puede meter estilos que rompan la tipografía.
 *
 * El subrayado está porque es la convención de énfasis de los documentos de la
 * iglesia: así es como el tratado marca sus tesis. Se estiliza en salvia y
 * despegado de la línea base para que no se confunda con un enlace.
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    code: false,
    horizontalRule: false,
    strike: false,
    link: false,
  }),
  // Las llamadas a nota del manual del bautismo van en superíndice.
  Superscript,
  Placeholder.configure({ placeholder: "Escribe el texto…" }),
];
