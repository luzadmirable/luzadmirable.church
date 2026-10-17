"use client";

import { useEffect } from "react";

/**
 * Marca con `data-stuck` el rótulo de capítulo que está fijado arriba.
 *
 * CSS no tiene un selector para «elemento pegado»: `position: sticky` no
 * expone ese estado. Y hace falta, porque la pestaña solo alcanza al rótulo
 * que está en el borde superior — los demás van en el flujo normal y no deben
 * apartarse de nada.
 *
 * El truco es observar el propio elemento con el umbral al 100% y el borde
 * superior de la raíz encogido un píxel: al quedar pegado, ese píxel lo deja
 * fuera y la proporción visible baja de 1. La comprobación de `top` descarta
 * el otro caso que también baja de 1 — estar entrando por abajo de la
 * pantalla —, que si no marcaría como fijado un rótulo del fondo.
 *
 * Va montado DENTRO de la frontera de Suspense del documento, a propósito:
 * así su efecto corre con el subárbol ya hidratado y los rótulos ya en su
 * sitio. Montado fuera, empezaba a marcarlos mientras React todavía los
 * hidrataba, y React protestaba por atributos que él no había puesto.
 */
export function StuckPins() {
  useEffect(() => {
    const pins = document.querySelectorAll<HTMLElement>(".chapter-pin");
    if (!pins.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const stuck =
            entry.intersectionRatio < 1 && entry.boundingClientRect.top <= 1;
          (entry.target as HTMLElement).toggleAttribute("data-stuck", stuck);
        }
      },
      { threshold: [1], rootMargin: "-1px 0px 0px 0px" },
    );
    for (const pin of pins) io.observe(pin);

    return () => {
      io.disconnect();
      for (const pin of pins) pin.removeAttribute("data-stuck");
    };
  }, []);

  return null;
}
