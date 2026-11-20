/**
 * Anexo descargable de un documento.
 *
 * La membresía exige llenar una solicitud; el documento la nombra pero la
 * hoja vive aparte, en `public/descargas`. Esto la pone al alcance sin salir
 * del texto que la pide.
 *
 * Lleva `download` a propósito: un PDF enlazado a secas se abre dentro del
 * navegador, y esta hoja no es para leerla sino para imprimirla y firmarla.
 */
export function DocumentDownload({
  path,
  label,
}: {
  path: string;
  label: string;
}) {
  const extension = path.split(".").pop()?.toUpperCase();

  return (
    <a href={path} download className="doc-download no-print">
      <svg
        className="doc-download-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16" />
      </svg>

      <span className="doc-download-text">
        <span className="doc-download-label">{label}</span>
        {extension ? (
          <span className="doc-download-meta">
            {extension} · para imprimir y firmar
          </span>
        ) : null}
      </span>

      <span className="doc-download-cue">Descargar</span>
    </a>
  );
}
