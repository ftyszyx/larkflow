import type { AuthedUser } from "./middleware/auth.ts";
import type { WorkspaceRole } from "./middleware/workspace.ts";

export type AppVariables = {
  user: AuthedUser;
  workspaceId: number;
  role: WorkspaceRole;
};

export type AppEnv = {
  Variables: AppVariables;
};
