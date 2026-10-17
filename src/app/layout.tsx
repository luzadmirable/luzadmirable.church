import type { Metadata, Viewport } from "next";
import { Alegreya, Alegreya_Sans, Cinzel } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-cinzel",
  display: "swap",
});

const alegreya = Alegreya({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-alegreya",
  display: "swap",
});

const alegreyaSans = Alegreya_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-alegreya-sans",
  display: "swap",
});

/**
 * Kingred Modern no está en Google Fonts: se autohospeda desde nuestro propio
 * dominio. Le faltan ¿ ¡ — …, así que la pila de respaldo es Alegreya, que es
 * la de la casa y no canta cuando aparece uno de esos signos.
 */
const kingred = localFont({
  src: "../fonts/KingredModern.woff2",
  variable: "--font-kingred",
  display: "swap",
  fallback: ["Alegreya", "Georgia", "serif"],
});

export const metadata: Metadata = {
  title: {
    default: "Luz Admirable",
    template: "%s · Luz Admirable",
  },
  description:
    "Documentos normativos de la iglesia Luz Admirable: membresía y bases doctrinales.",
};

/**
 * Safari móvil colapsa su barra superior al bajar y le entrega la pantalla
 * entera al documento, con la barra de estado flotando encima. Sin un color
 * declarado la deja translúcida y el texto se asoma por detrás del reloj.
 * Declarado, pinta esa franja de color papel y la página vuelve a terminar
 * donde parece que termina. Son los mismos valores que `--paper`.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fefdf8" },
    { media: "(prefers-color-scheme: dark)", color: "#15130e" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${cinzel.variable} ${alegreya.variable} ${alegreyaSans.variable} ${kingred.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
