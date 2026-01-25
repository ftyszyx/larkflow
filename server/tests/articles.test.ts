import { sql } from "drizzle-orm";
import { app } from "../app.ts";
import { db } from "../db.ts";
import { signUserJwt } from "../utils/jwt.ts";
import { hashPassword } from "../utils/password.ts";

const headersFor = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

Deno.test("GET /articles returns only workspace articles and supports pagination", async () => {
  const email = "tester@example.com";
  const passwordHash = await hashPassword("pass");

  const w1 = await db.execute<{ id: number }>(sql`
    insert into workspaces(name) values ('w1') returning id
  `);
  const w2 = await db.execute<{ id: number }>(sql`
    insert into workspaces(name) values ('w2') returning id
  `);
  const workspaceId1 = w1.rows[0].id;
  const workspaceId2 = w2.rows[0].id;

  const integration = await db.execute<{ id: unknown }>(sql`
    insert into integrations(workspace_id, platform_type, name, status, config)
    values (${workspaceId1}, 1, 'i1', 'connected', '{}'::jsonb)
    returning id
  `);
  const integrationId = Number(integration.rows[0].id);
  if (!Number.isFinite(integrationId)) throw new Error("failed to create integration");

  const u = await db.execute<{ id: number }>(sql`
    insert into users(email, name, password_hash) values (${email}, 'tester', ${passwordHash})
    on conflict(email) do update set name = excluded.name, password_hash = excluded.password_hash, updated_at = now()
    returning id
  `);
  const userId = u.rows[0].id;

  const token = await signUserJwt({ uid: userId, email, isPlatformAdmin: false });

  await db.execute(sql`
    insert into workspace_members(workspace_id, user_id, role)
    values (${workspaceId1}, ${userId}, 'owner')
    on conflict(workspace_id, user_id) do update set role = excluded.role
  `);

  await db.execute(sql`
    insert into articles(workspace_id, integration_id, source_doc_token, title, content_md, content_md_final, status)
    values
      (${workspaceId1}, ${integrationId}, 'doc1', 'a1', '', '', 'draft'),
      (${workspaceId1}, ${integrationId}, 'doc2', 'a2', '', '', 'draft'),
      (${workspaceId2}, ${integrationId}, 'doc3', 'b1', '', '', 'draft')
  `);

  const res = await app.request(`/api/w/${workspaceId1}/articles?limit=1&offset=0`, {
    headers: headersFor(token),
  });
  if (!res.ok) throw new Error(`unexpected status: ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json.data)) throw new Error("missing data array");
  if (json.data.length !== 1) throw new Error("pagination not applied");

  for (const a of json.data) {
    if (a.workspaceId !== workspaceId1) throw new Error("workspace isolation failed");
  }
});
