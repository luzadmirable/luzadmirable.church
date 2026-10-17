"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="label-util text-[0.66rem] text-ink-faint">
          Contraseña
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          required
          className="border border-rule bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </label>

      {state.error ? (
        <p className="border-l-2 border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="label-util bg-accent px-4 py-2.5 text-[0.7rem] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
