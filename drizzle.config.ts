import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// Las migraciones van por conexión directa, no por el pooler. Y con el mismo
// `verify-full` explícito que la app, para no arrastrar el aviso de pg aquí.
const url = (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)?.replace(
  /([?&]sslmode=)(require|prefer|verify-ca)\b/,
  "$1verify-full",
);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: url! },
});
