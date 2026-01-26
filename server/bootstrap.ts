/*
init admin user and workspace
 */
import { eq } from "drizzle-orm";
import { db } from "./db.ts";
import { users, workspaceMembers, workspaces } from "./drizzle/schema.ts";
import { hashPassword } from "./utils/password.ts";

export const bootstrapSeedAdmin = async () => {
  const email = (Deno.env.get("SEED_ADMIN_EMAIL") ?? "").trim().toLowerCase();
  const password = Deno.env.get("SEED_ADMIN_PASSWORD") ?? "";
  const workspaceName = (Deno.env.get("SEED_WORKSPACE_NAME") ?? "").trim();

  if (!email || !password || !workspaceName) return;

  const passwordHash = await hashPassword(password);

  const userRows = await db
    .insert(users)
    .values({ email, name: "seed admin", passwordHash, isPlatformAdmin: true })
    .onConflictDoNothing({
      target: users.email,
    })
    .returning({ id: users.id });

  let userId: number;
  if (userRows.length > 0) {
    userId = userRows[0].id;
  } else {
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!existingUser) return;
    userId = existingUser.id;
  }

  const [existingWs] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.name, workspaceName))
    .limit(1);

  let workspaceId: number;
  if (existingWs) {
    workspaceId = existingWs.id;
  } else {
    const wsRows = await db.insert(workspaces).values({ name: workspaceName }).returning({ id: workspaces.id });
    workspaceId = wsRows[0].id;
  }

  await db
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role: "owner" })
    .onConflictDoNothing({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
    });
};
