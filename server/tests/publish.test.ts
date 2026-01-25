import { sql } from "drizzle-orm";
import { app } from "../app.ts";
import { db } from "../db.ts";
import { signUserJwt } from "../utils/jwt.ts";
import { hashPassword } from "../utils/password.ts";

const headersFor = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

Deno.test("POST /articles/:id/publish creates job and sets publication to publishing", async () => {
  const email = "publisher@example.com";
  const passwordHash = await hashPassword("pass1234");

  const w = await db.execute<{ id: number }>(sql`
    insert into workspaces(name) values ('pub-w') returning id
  `);
  const workspaceId = w.rows[0].id;

  const u = await db.execute<{ id: number }>(sql`
    insert into users(email, name, password_hash) values (${email}, 'publisher', ${passwordHash})
    on conflict(email) do update set name = excluded.name, password_hash = excluded.password_hash, updated_at = now()
    returning id
  `);
  const userId = u.rows[0].id;

  const token = await signUserJwt({ uid: userId, email, isPlatformAdmin: false });

  await db.execute(sql`
    insert into workspace_members(workspace_id, user_id, role)
    values (${workspaceId}, ${userId}, 'member')
    on conflict(workspace_id, user_id) do update set role = excluded.role
  `);

  const integration = await db.execute<{ id: number }>(sql`
    insert into integrations(workspace_id, platform_type, name, status, config)
    values (${workspaceId}, 1, 'i1', 'connected', '{}'::jsonb)
    returning id
  `);
  const integrationId = Number(integration.rows[0].id);
  if (!Number.isFinite(integrationId)) throw new Error("failed to create integration");

  const article = await db.execute<{ id: number }>(sql`
    insert into articles(workspace_id, integration_id, source_doc_token, title, content_md, content_md_final, status)
    values (${workspaceId}, ${integrationId}, 'doc1', 'title', '', '', 'draft')
    returning id
  `);
  const articleId = Number(article.rows[0].id);
  if (!Number.isFinite(articleId)) throw new Error("failed to create article");

  const res = await app.request(`/api/w/${workspaceId}/articles/${articleId}/publish`, {
    method: "POST",
    headers: {
      ...headersFor(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ integrationId, platformType: 1 }),
  });

  if (res.status !== 201) {
    const text = await res.text().catch(() => "");
    throw new Error(`unexpected status: ${res.status} ${text}`);
  }

  const pub = await db.execute<{ status: string }>(sql`
    select status from article_publications
    where workspace_id = ${workspaceId} and article_id = ${articleId} and integration_id = ${integrationId} and platform_type = 1
    limit 1
  `);

  if (pub.rows.length === 0) throw new Error("publication not created");
  if (pub.rows[0].status !== "publishing") throw new Error("publication status not publishing");

  const job = await db.execute<{ queue: string }>(sql`
    select queue from jobs where queue = 'publish_article' limit 1
  `);
  if (job.rows.length === 0) throw new Error("publish job not created");
});
