import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  // points to your schema file
  schema: "./prisma/schema.prisma",

  // migrations folder (optional, keep if you use migrations)
  migrations: {
    path: "./prisma/migrations",
    seed: "ts-node ./prisma/seed-admin.ts",
  },

  // Move the connection URL here (v7)
  datasource: {
    url: env("DATABASE_URL"),
    // you may include shadowDatabaseUrl or other datasource props if you use them
  },
});
