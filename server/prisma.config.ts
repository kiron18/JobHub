import "dotenv/config";
import { defineConfig } from "prisma/config";

// For migrations, prefer DIRECT_URL (session pooler / non-pooled). PgBouncer
// transaction mode (port 6543) breaks Prisma's prepared statements, so
// `prisma migrate deploy` MUST go through a session-mode connection.
// Fall back to DATABASE_URL only when DIRECT_URL is unset (dev convenience).
const migrationUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
