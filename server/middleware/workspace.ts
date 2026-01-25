import { and, eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { db } from "../db.ts";
import { workspaceMembers } from "../drizzle/schema.ts";
import type { AuthedUser } from "./auth.ts";
import type { AppEnv } from "../types.ts";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

const getHeader = (c: Parameters<MiddlewareHandler<AppEnv>>[0], name: string) => {
  const value = c.req.header(name);
  return value && value.trim() ? value.trim() : null;
};

export const requireWorkspace: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = getHeader(c, "X-Workspace-Id");
  if (!raw) return c.json({ message: "missing X-Workspace-Id" }, 400);
  const workspaceId = Number(raw);
  if (!Number.isFinite(workspaceId)) return c.json({ message: "invalid X-Workspace-Id" }, 400);
  c.set("workspaceId", workspaceId);
  await next();
};

export const requireWorkspaceMember: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user") as AuthedUser;
  const workspaceId = c.get("workspaceId") as number;

  const row = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);

  const membership = row[0];
  if (!membership) return c.json({ message: "forbidden" }, 403);

  c.set("role", membership.role as WorkspaceRole);
  await next();
};

export const requireRole = (allowed: WorkspaceRole[]): MiddlewareHandler<AppEnv> => async (c, next) => {
  const role = c.get("role") as WorkspaceRole;
  if (!allowed.includes(role)) return c.json({ message: "forbidden" }, 403);
  await next();
};
