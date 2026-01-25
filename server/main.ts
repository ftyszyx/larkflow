import { app } from "./app.ts";
import { bootstrapSeedAdmin } from "./bootstrap.ts";

await bootstrapSeedAdmin();

Deno.serve(app.fetch);
