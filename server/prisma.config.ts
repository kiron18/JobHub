import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations need a session-mode connection: PgBouncer transaction mode
// (Supabase pooler port 6543) breaks Prisma's prepared statements. Prefer
// DIRECT_URL when set; otherwise derive session mode from DATABASE_URL by
// swapping the transaction-pooler port for 5432 and dropping pgbouncer=true,
// so deploy environments only ever need DATABASE_URL.
function sessionModeUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (u.port === "6543") u.port = "5432";
    u.searchParams.delete("pgbouncer");
    return u.toString();
  } catch {
    return raw;
  }
}

const migrationUrl = process.env["DIRECT_URL"] || sessionModeUrl(process.env["DATABASE_URL"]);

// schema.prisma declares directUrl = env("DIRECT_URL") and the CLI validates
// it, so backfill the derived value when the env var is missing or empty.
if (migrationUrl) process.env["DIRECT_URL"] = migrationUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
