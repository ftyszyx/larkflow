import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db.ts";
import { articles } from "./drizzle/schema.ts";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/healthz", async (c) => {
  const rows = await db.execute<{ ok: number }>(sql`select 1 as ok`);
  return c.json({ ok: true, db: rows.rows?.[0]?.ok ?? 1 });
});

app.get("/articles", async (c) => {
  const status = c.req.query("status");
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
  const offset = Math.max(Number(c.req.query("offset") ?? 0) || 0, 0);

  const where = status ? eq(articles.status, status) : undefined;

  const data = await db
    .select()
    .from(articles)
    .where(where)
    .orderBy(desc(articles.updatedAt))
    .limit(limit)
    .offset(offset);

  return c.json({ data, limit, offset });
});

app.get("/articles/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ message: "invalid id" }, 400);

  const row = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  const article = row[0];
  if (!article) return c.json({ message: "not found" }, 404);

  return c.json({ data: article });
});

app.post("/articles", async (c) => {
  const body = await c.req.json().catch(() => null) as null | {
    title?: string;
    summary?: string | null;
    coverAssetId?: number | null;
    coverUrl?: string | null;
    contentMd?: string;
    contentMdFinal?: string;
    status?: string;
  };

  if (!body?.title) return c.json({ message: "title is required" }, 400);

  const inserted = await db
    .insert(articles)
    .values({
      title: body.title,
      summary: body.summary ?? null,
      coverAssetId: body.coverAssetId ?? null,
      coverUrl: body.coverUrl ?? null,
      contentMd: body.contentMd ?? "",
      contentMdFinal: body.contentMdFinal ?? "",
      status: body.status ?? "draft",
    })
    .returning();

  return c.json({ data: inserted[0] }, 201);
});

app.patch("/articles/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ message: "invalid id" }, 400);

  const body = await c.req.json().catch(() => null) as null | {
    title?: string;
    summary?: string | null;
    coverAssetId?: number | null;
    coverUrl?: string | null;
    contentMd?: string;
    contentMdFinal?: string;
    status?: string;
  };
  if (!body) return c.json({ message: "invalid json" }, 400);

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.summary !== undefined) patch.summary = body.summary;
  if (body.coverAssetId !== undefined) patch.coverAssetId = body.coverAssetId;
  if (body.coverUrl !== undefined) patch.coverUrl = body.coverUrl;
  if (body.contentMd !== undefined) patch.contentMd = body.contentMd;
  if (body.contentMdFinal !== undefined) patch.contentMdFinal = body.contentMdFinal;
  if (body.status !== undefined) patch.status = body.status;

  const updated = await db
    .update(articles)
    .set(patch)
    .where(eq(articles.id, id))
    .returning();

  if (updated.length === 0) return c.json({ message: "not found" }, 404);
  return c.json({ data: updated[0] });
});

Deno.serve(app.fetch);
