import { Logo } from "./Logo";

/**
 * Ocupa exactamente la pantalla y nada más. Sin pestaña: la marca entra
 * después, al bajar, y lo hace desde la barra fija para que sea el mismo
 * objeto y no dos pestañas distintas.
 */
export function SplashHero({
  children,
  cite,
}: {
  children?: React.ReactNode;
  cite?: string;
}) {
  return (
    <section className="splash no-print" aria-label="Luz Admirable">
      <div className="splash-stage">
        <div className="splash-logo">
          <Logo width={360} />
        </div>
        {children ? (
          <blockquote className="splash-quote">
            <p className="splash-tagline">{children}</p>
            {cite ? <cite className="splash-cite">{cite}</cite> : null}
          </blockquote>
        ) : null}
      </div>
      <div className="splash-cue" aria-hidden="true">
        <span className="label-util">Desliza</span>
        <span className="splash-cue-line" />
      </div>
    </section>
  );
}
