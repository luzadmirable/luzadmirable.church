/**
 * Entrada ligada al scroll. La animación vive en CSS (`animation-timeline:
 * view()`); si el navegador no la soporta o el usuario pidió menos
 * movimiento, el contenido simplemente se ve. Nunca queda nada escondido
 * esperando a un observador.
 *
 * `as` permite no meter un div extra donde estorbaría — por ejemplo encima de
 * un título fijado con `sticky`, que se rompe si un ancestro se transforma.
 */
export function Reveal({
  children,
  delay,
  className = "",
}: {
  children: React.ReactNode;
  delay?: 2 | 3;
  className?: string;
}) {
  return (
    <div className={`reveal ${className}`} data-delay={delay}>
      {children}
    </div>
  );
}
