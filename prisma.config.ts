// Prisma configuration for Prisma 7
// Move datasource URL here (required for `prisma migrate dev`)

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    // Use env() helper so Prisma sees a concrete, required URL at config-load time
    url: env("DATABASE_URL"),
  },
});
