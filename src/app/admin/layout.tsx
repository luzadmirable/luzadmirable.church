import Link from "next/link";
import { logout } from "@/actions/auth";
import { hasSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Panel" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const signedIn = await hasSession();

  return (
    <div className="min-h-dvh font-util">
      <header className="admin-bar border-b border-rule bg-surface">
        <div className="admin-tab" aria-hidden="true" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-4 pr-6 pl-[5.5rem]">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo width={116} />
            <span className="label-util text-[0.64rem] text-ink-faint">Panel</span>
          </Link>
          <div className="flex items-baseline gap-5">
            <Link
              href="/"
              className="label-util text-[0.66rem] text-ink-faint hover:text-accent"
            >
              Ver el sitio
            </Link>
            {signedIn ? (
              <form action={logout}>
                <button
                  type="submit"
                  className="label-util text-[0.66rem] text-ink-faint hover:text-accent"
                >
                  Salir
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
