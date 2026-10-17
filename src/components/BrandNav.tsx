"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import flame from "../../public/flame-white.png";

type Doc = { slug: string; title: string };

/**
 * La pestaña de esquina que se despliega en panel con los documentos.
 *
 * No es un panel que aparece encima: es la misma pieza. El triángulo y el
 * panel son la misma superficie y lo único que se anima es su recorte, así que
 * el vértice inferior se desliza hasta la esquina y la pestaña se convierte en
 * el panel. Nada se mueve ni se escala.
 *
 * Se abre de dos maneras porque hay dos clases de dispositivo: apuntándola con
 * el cursor —puro CSS, sin estado— o tocando la llama, que es lo único que
 * funciona donde no hay cursor.
 */
export function BrandNav({
  documents,
  splash = false,
}: {
  documents: Doc[];
  splash?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Al bajar se esconde deslizándose hacia el vértice; al subir vuelve.
  const [hidden, setHidden] = useState(false);
  // Asomo de bienvenida: se despliega un cuarto y se recoge sola.
  const [peek, setPeek] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Tocar fuera o pulsar Escape lo cierra: en táctil no hay «salir con el
  // cursor» que lo haga por sí solo.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Esconder al bajar y volver al subir, solo en las pantallas de lectura. En
  // la portada no: ahí la pestaña tiene su propia entrada ligada al scroll
  // —crece desde el vértice y luego aparece la llama— y esconderla a media
  // animación se la comería.
  useEffect(() => {
    if (splash) return;
    let frame = 0;
    let lastY = Math.max(0, window.scrollY);
    let drift = 0;
    const read = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      lastY = y;
      if (y < 140) {
        drift = 0;
        setHidden(false);
        return;
      }
      if (delta > 0 !== drift > 0) drift = 0;
      drift += delta;
      if (drift > 10) setHidden(true);
      else if (drift < -10) setHidden(false);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [splash]);

  /**
   * Una esquina doblada se lee como algo que se puede jalar, pero el gesto hay
   * que enseñarlo — sobre todo en táctil, donde no existe el cursor que la
   * descubra por accidente. Así que al entrar se asoma sola una vez, y la
   * visita se marca para no repetirlo.
   */
  useEffect(() => {
    let seen = true;
    try {
      seen = sessionStorage.getItem("la:peek") === "1";
    } catch {
      // Navegación privada: mejor enseñarlo que no enseñarlo.
      seen = false;
    }
    if (seen) return;

    const show = window.setTimeout(() => setPeek(true), 900);
    const hide = window.setTimeout(() => {
      setPeek(false);
      try {
        sessionStorage.setItem("la:peek", "1");
      } catch {
        /* sin almacenamiento, se asomará otra vez: no pasa nada */
      }
    }, 1750);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  // Con el menú abierto nunca se esconde.
  const away = hidden && !open;

  // El estado se publica en <html>: el rótulo de capítulo fijado necesita
  // saber si la pestaña ocupa la esquina para apartarse, o si puede ocuparla.
  useEffect(() => {
    document.documentElement.dataset.tab = away ? "away" : "here";
    return () => {
      delete document.documentElement.dataset.tab;
    };
  }, [away]);

  return (
    <nav
      ref={ref}
      className="brand-nav no-print"
      data-splash={splash || undefined}
      data-open={open || undefined}
      data-away={away || undefined}
      data-peek={peek && !open ? "" : undefined}
      aria-label="Documentos"
    >
      {/* La cáscara la escala la animación de entrada de la portada; el panel
          de dentro se recorta al abrirse. En capas separadas porque una
          animación de scroll con `fill: both` fijaría la propiedad y
          bloquearía la otra. */}
      <div className="brand-nav-shell">
        <div className="brand-nav-panel">
          <button
            type="button"
            className="brand-nav-trigger"
            aria-expanded={open}
            aria-label={open ? "Cerrar el menú" : "Abrir el menú"}
            onClick={() => setOpen((was) => !was)}
          >
            <Image src={flame} alt="" className="brand-nav-flame" priority />
          </button>

          <div className="brand-nav-body">
            <p className="brand-nav-heading label-util">Documentos</p>
            <ul className="brand-nav-list">
              <li>
                {/* Al ancla, no a la raíz: desde un documento «Inicio» debe
                    llevar a la lista, no obligar a pasar otra vez por la portada. */}
                <Link
                  href="/#documentos"
                  className="brand-nav-link"
                  onClick={() => setOpen(false)}
                >
                  Inicio
                </Link>
              </li>
              {documents.map((doc) => (
                <li key={doc.slug}>
                  <Link
                    href={`/${doc.slug}`}
                    className="brand-nav-link"
                    onClick={() => setOpen(false)}
                  >
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}
