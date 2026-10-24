import type { WorkspaceRole } from "@/types";

export function canManageMembers(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageProjects(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canDeleteWorkspace(role: WorkspaceRole): boolean {
  return role === "OWNER";
}

export function canChangeMemberRole(currentRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (targetRole === "OWNER") return false;
  return currentRole === "OWNER";
}

export function canRemoveMember(
  currentRole: WorkspaceRole,
  isSelf: boolean,
  targetRole: WorkspaceRole
): boolean {
  // The workspace owner can never be removed or leave
  if (targetRole === "OWNER") return false;
  // Non-owner can leave the workspace
  if (isSelf) return true;
  // OWNER can remove any ADMIN or MEMBER
  if (currentRole === "OWNER") return true;
  // ADMIN can remove MEMBER, but not another ADMIN
  if (currentRole === "ADMIN" && targetRole === "MEMBER") return true;
  return false;
}
