import type { Config } from "drizzle-kit";

const databaseUrl = Deno.env.get("DATABASE_URL");

export default {
    schema: "./db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: databaseUrl!,
    },
} satisfies Config;
