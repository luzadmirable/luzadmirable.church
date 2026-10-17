import { redirect } from "next/navigation";
import { hasSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar" };

// Ruta tras sesión: se renderiza siempre en el servidor, no se prerenderiza.
export const instant = false;

export default async function LoginPage() {
  if (await hasSession()) redirect("/admin");
  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <Logo width={180} />
      <h1 className="label-caps mt-10 text-xl text-ink">Acceso al panel</h1>
      <p className="mt-3 font-body text-ink-soft">
        Esta zona permite modificar el texto vigente de los documentos de la
        iglesia.
      </p>
      <LoginForm />
    </main>
  );
}
