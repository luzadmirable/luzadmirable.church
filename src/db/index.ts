import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  // El build prerenderiza las páginas de los documentos, así que necesita la
  // base también al construir, no solo al servir. Fallar aquí es deliberado:
  // sin esto el sitio se publicaría vacío y en silencio.
  throw new Error(
    "Falta DATABASE_URL.\n" +
      "  · En local:  npx neon@latest env pull\n" +
      "  · En Vercel: Settings → Environment Variables. Copia el valor de\n" +
      "    .env.local y márcala en Production, Preview y Development.\n" +
      "    Hacen falta también DATABASE_URL_UNPOOLED, ADMIN_PASSWORD y\n" +
      "    SESSION_SECRET.",
  );
}

/**
 * `pg` avisa de que hoy trata `sslmode=require` como `verify-full`, y de que
 * en su versión 9 pasará a la semántica de libpq, más laxa. Pedimos
 * explícitamente lo estricto: mismo comportamiento que hay ahora, sin aviso, y
 * sin que un cambio de versión lo relaje a nuestras espaldas.
 *
 * Se normaliza aquí y no en el `.env`, porque esa cadena la escribe Neon y
 * `neon env pull` la sobrescribe —en Vercel la inyecta la integración—, así
 * que cualquier arreglo a mano se perdería en el siguiente despliegue.
 */
export function strictSsl(url: string): string {
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)\b/, "$1verify-full");
}

/**
 * node-postgres sobre la cadena con pooler, que es lo que Neon recomienda para
 * Vercel con Fluid compute. En desarrollo el pool se guarda en globalThis para
 * que el hot reload no abra una conexión nueva en cada recarga.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: strictSsl(process.env.DATABASE_URL),
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

// Permite a Vercel drenar el pool cuando la instancia se suspende.
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
export * from "./schema";
