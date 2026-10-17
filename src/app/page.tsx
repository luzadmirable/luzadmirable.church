import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { BrandTab } from "@/components/BrandTab";
import { SplashHero } from "@/components/SplashHero";
import { listDocuments } from "@/lib/queries";

export default async function HomePage() {
  const documents = await listDocuments();

  return (
    <>
      {/* Texto de Reina-Valera 1960, con los puntos suspensivos marcando lo
          omitido: en cuanto se cita el versículo, la cita y el texto tienen
          que coincidir. El nombre de la iglesia sale de aquí. */}
      <SplashHero cite="1 Pedro 2:9">
        Mas vosotros sois linaje escogido… para que anunciéis las virtudes de
        aquel que os llamó de las tinieblas a su luz admirable.
      </SplashHero>
      <BrandTab splash />

      <main id="documentos" className="below-splash">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <Reveal>
            <p className="kicker text-[0.92rem] text-accent">
              Iglesia Luz Admirable
            </p>
            <h1 className="text-reveal title-xl mt-3 text-[2.1rem] text-balance text-ink sm:text-[2.9rem]">
              Documentos normativos
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
              El texto vigente de nuestro documento de membresía y de las bases
              doctrinales que sostienen la enseñanza de la congregación.
            </p>
          </Reveal>

          {documents.length === 0 ? (
            <p className="mt-12 border border-rule bg-surface p-6 text-ink-soft">
              Todavía no hay documentos. Crea el primero desde{" "}
              <Link href="/admin" className="text-accent underline">
                el panel de administración
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-12 flex flex-col border-t border-rule">
              {documents.map((doc, index) => (
                <li key={doc.slug} className="border-b border-rule">
                  <Reveal delay={index === 0 ? undefined : 2}>
                    <Link
                      href={`/${doc.slug}`}
                      className="group flex items-center gap-4 py-6 transition-colors hover:bg-surface active:bg-surface sm:gap-8"
                    >
                      <div className="flex flex-1 flex-col gap-1">
                        <h2 className="title-lg text-[1.2rem] text-ink transition-colors group-hover:text-accent">
                          {doc.title}
                        </h2>
                        {doc.subtitle ? (
                          <p className="font-sub text-ink-soft italic">
                            {doc.subtitle}
                          </p>
                        ) : null}
                      </div>
                      {/* La única pista de que el renglón lleva a algún sitio.
                          Tiene que verse en reposo: en el teléfono no hay
                          cursor que revele nada al pasar por encima. */}
                      <svg
                        className="doc-arrow"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
