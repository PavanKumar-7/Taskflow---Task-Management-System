"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  LogOut,
  Mail,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  Send,
  Clock,
  Copy,
  Check,
  Ban,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/context/workspace-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  WorkspaceMemberDetails,
  WorkspaceRole,
  WorkspaceInvitationDetails,
} from "@/types";
import { canChangeMemberRole, canRemoveMember } from "@/lib/permissions/roles";

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function RoleBadge({ role }: { role: WorkspaceRole }) {
  if (role === "OWNER") {
    return (
      <Badge
        variant="default"
        className="gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs"
      >
        <ShieldAlert className="size-3" />
        <span>Owner</span>
      </Badge>
    );
  }
  if (role === "ADMIN") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20 text-xs"
      >
        <ShieldCheck className="size-3" />
        <span>Admin</span>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground text-xs">
      <Shield className="size-3" />
      <span>Member</span>
    </Badge>
  );
}

export function WorkspaceMembers() {
  const {
    currentWorkspace,
    user: currentUser,
    refreshWorkspaces,
  } = useWorkspace();
  const [members, setMembers] = useState<WorkspaceMemberDetails[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitationDetails[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite / Add Dialog state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [devInviteUrl, setDevInviteUrl] = useState<string | null>(null);
  const [devEmailPreview, setDevEmailPreview] = useState<{
    to: string;
    from: string;
    subject: string;
    html: string;
    text: string;
    inviteUrl: string;
  } | null>(null);
  const [previewTab, setPreviewTab] = useState<"html" | "text">("html");
  const [emailDeliveryNotice, setEmailDeliveryNotice] = useState<string | null>(
    null,
  );
  const [hasCopiedDevUrl, setHasCopiedDevUrl] = useState(false);

  // Remove / Leave Dialog state
  const [memberToRemove, setMemberToRemove] =
    useState<WorkspaceMemberDetails | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Revoke Invitation state
  const [invitationToRevoke, setInvitationToRevoke] =
    useState<WorkspaceInvitationDetails | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Role update in-flight state
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const currentUserRole: WorkspaceRole = currentWorkspace?.role || "MEMBER";
  const canManage = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const isOwner = currentUserRole === "OWNER";

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace) {
      setMembers([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/members`,
        {
          cache: "no-store",
        },
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message || "Failed to load workspace members.");
        return;
      }

      setMembers(json.data || []);
    } catch {
      setError("Network error while loading members.");
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace]);

  const fetchInvitations = useCallback(async () => {
    if (!currentWorkspace || !canManage) {
      setInvitations([]);
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/invitations`,
        {
          cache: "no-store",
        },
      );
      const json = await res.json();
      if (res.ok && json.success) {
        setInvitations(json.data || []);
      }
    } catch {
      // Ignore background invitation fetch error
    }
  }, [currentWorkspace, canManage]);

  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      if (!currentWorkspace) {
        setMembers([]);
        setInvitations([]);
        setIsLoading(false);
        return;
      }

      try {
        const [membersRes, invitesRes] = await Promise.all([
          fetch(`/api/v1/workspaces/${currentWorkspace.id}/members`, {
            cache: "no-store",
          }),
          canManage
            ? fetch(`/api/v1/workspaces/${currentWorkspace.id}/invitations`, {
                cache: "no-store",
              })
            : Promise.resolve(null),
        ]);

        const membersJson = await membersRes.json();
        if (ignore) return;

        if (!membersRes.ok || !membersJson.success) {
          setError(
            membersJson.error?.message || "Failed to load workspace members.",
          );
          return;
        }

        setMembers(membersJson.data || []);

        if (invitesRes) {
          const invitesJson = await invitesRes.json();
          if (invitesRes.ok && invitesJson.success) {
            setInvitations(invitesJson.data || []);
          }
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading members.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      ignore = true;
    };
  }, [currentWorkspace, canManage]);

  if (!currentWorkspace) {
    return null;
  }

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setDevInviteUrl(null);

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    setIsSendingInvite(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role: inviteRole }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        setInviteError(json.error?.message || "Failed to create invitation.");
        return;
      }

      const outcome = json.data?.outcome;

      if (outcome === "accepted" || json.data?.emailAccepted) {
        toast.success(`Email accepted by the provider for ${email}.`);
        setIsInviteOpen(false);
        setInviteEmail("");
        setDevInviteUrl(null);
        setDevEmailPreview(null);
        setEmailDeliveryNotice(null);
      } else if (
        outcome === "preview" ||
        json.data?.emailReason === "DEV_PREVIEW_MODE"
      ) {
        toast.info(
          "Email captured in local preview mode; no real email was sent.",
        );
        setEmailDeliveryNotice(
          "Email captured in local preview mode; no real email was sent.",
        );
        if (json.data?.devInviteUrl) setDevInviteUrl(json.data.devInviteUrl);
        if (json.data?.devEmailPreview)
          setDevEmailPreview(json.data.devEmailPreview);
      } else {
        const errorMsg = json.data?.emailError || "Email sending failed.";
        toast.warning(
          `Invitation created, but email sending failed: ${errorMsg}`,
        );
        setEmailDeliveryNotice(
          `Invitation created, but email sending failed: ${errorMsg}`,
        );
        if (json.data?.devInviteUrl) setDevInviteUrl(json.data.devInviteUrl);
        if (json.data?.devEmailPreview)
          setDevEmailPreview(json.data.devEmailPreview);
      }

      fetchInvitations();
    } catch {
      setInviteError("Network error while sending invitation.");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleRevokeInvitation = async () => {
    if (!invitationToRevoke) return;

    setIsRevoking(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/invitations/${invitationToRevoke.id}`,
        { method: "DELETE" },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to revoke invitation.");
        return;
      }

      toast.success("Invitation revoked successfully.");
      setInvitationToRevoke(null);
      fetchInvitations();
    } catch {
      toast.error("Network error while revoking invitation.");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleRoleChange = async (
    memberId: string,
    newRole: "ADMIN" | "MEMBER",
  ) => {
    setUpdatingMemberId(memberId);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/members/${memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to update member role.");
        return;
      }

      toast.success("Member role updated successfully.");
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      );
      refreshWorkspaces();
    } catch {
      toast.error("Network error updating role.");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;

    setIsRemoving(true);
    const isSelf = memberToRemove.userId === currentUser?.id;

    try {
      const res = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/members/${memberToRemove.id}`,
        { method: "DELETE" },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to remove member.");
        return;
      }

      toast.success(
        isSelf
          ? "You have left the workspace."
          : `${memberToRemove.user.name} was removed from the workspace.`,
      );
      setMemberToRemove(null);
      fetchMembers();
      refreshWorkspaces();
    } catch {
      toast.error("Network error while removing member.");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleCopyDevUrl = () => {
    if (!devInviteUrl) return;
    navigator.clipboard.writeText(devInviteUrl);
    setHasCopiedDevUrl(true);
    toast.success("Dev invitation link copied!");
    setTimeout(() => setHasCopiedDevUrl(false), 2000);
  };

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === "PENDING",
  );

  return (
    <Card className="mt-6 border-border/80">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <CardTitle className="text-lg font-semibold">
                Team Members — {currentWorkspace.name}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Manage member roles, permissions, invitations, and team
              collaboration.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchMembers();
                if (canManage) fetchInvitations();
              }}
              disabled={isLoading}
              title="Refresh member list"
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw
                className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {canManage && (
              <Button
                size="sm"
                onClick={() => {
                  setInviteError(null);
                  setDevInviteUrl(null);
                  setDevEmailPreview(null);
                  setEmailDeliveryNotice(null);
                  setInviteEmail("");
                  setInviteRole("MEMBER");
                  setIsInviteOpen(true);
                }}
                className="h-8 gap-1.5 text-xs"
              >
                <UserPlus className="size-3.5" />
                <span>Invite Member</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-xs text-destructive"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMembers}
              className="h-7 text-xs"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && members.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 animate-pulse h-14"
              />
            ))}
          </div>
        ) : members.length === 0 && !error ? (
          /* Empty state */
          <div className="p-8 text-center border rounded-lg bg-muted/10">
            <Users className="size-8 mx-auto text-muted-foreground/60 mb-2" />
            <h4 className="text-sm font-semibold text-foreground">
              No members found
            </h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              This workspace has no registered members yet. Invite team members
              to start collaborating.
            </p>
          </div>
        ) : (
          /* Members list */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active Members ({members.length})
              </h3>
            </div>

            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
              {members.map((member) => {
                const isSelf = member.userId === currentUser?.id;
                const canEditThisRole = canChangeMemberRole(
                  currentUserRole,
                  member.role,
                );
                const canRemoveThisMember = canRemoveMember(
                  currentUserRole,
                  isSelf,
                  member.role,
                );
                const isUpdatingThis = updatingMemberId === member.id;

                return (
                  <div
                    key={member.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-muted/40 transition-colors"
                  >
                    {/* User info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="size-9 shrink-0 border">
                        {member.user.avatarUrl && (
                          <AvatarImage
                            src={member.user.avatarUrl}
                            alt={member.user.name}
                          />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(member.user.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                            {member.user.name}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                              You
                            </span>
                          )}
                          <RoleBadge role={member.role} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span
                            className="flex items-center gap-1 truncate"
                            title={member.user.email}
                          >
                            <Mail className="size-3 shrink-0" />
                            <span className="truncate">
                              {member.user.email}
                            </span>
                          </span>
                          <span className="hidden md:flex items-center gap-1 shrink-0">
                            <Calendar className="size-3" />
                            <span>
                              Joined{" "}
                              {new Date(member.joinedAt).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Role control & actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {canEditThisRole ? (
                        <div className="flex items-center gap-1">
                          <select
                            aria-label={`Change role for ${member.user.name}`}
                            value={member.role}
                            disabled={isUpdatingThis}
                            onChange={(e) =>
                              handleRoleChange(
                                member.id,
                                e.target.value as "ADMIN" | "MEMBER",
                              )
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                          {isUpdatingThis && (
                            <Loader2 className="size-3 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      ) : null}

                      {canRemoveThisMember && (
                        <Button
                          variant={isSelf ? "outline" : "ghost"}
                          size="sm"
                          onClick={() => setMemberToRemove(member)}
                          className={`h-8 px-2 text-xs gap-1 ${
                            isSelf
                              ? "text-muted-foreground hover:text-destructive hover:border-destructive/40"
                              : "text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                          }`}
                          title={
                            isSelf
                              ? "Leave this workspace"
                              : `Remove ${member.user.name}`
                          }
                        >
                          {isSelf ? (
                            <>
                              <LogOut className="size-3.5" />
                              <span>Leave</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="size-3.5" />
                              <span className="hidden sm:inline">Remove</span>
                            </>
                          )}
                        </Button>
                      )}

                      {member.role === "OWNER" && !isSelf && (
                        <span className="text-[11px] text-muted-foreground/70 italic px-2">
                          Workspace Owner
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending Invitations Section (for OWNER & ADMIN) */}
        {canManage && pendingInvitations.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" />
                Pending Invitations ({pendingInvitations.length})
              </h3>
            </div>

            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 shrink-0">
                      <Mail className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground truncate">
                          {inv.email}
                        </span>
                        <RoleBadge role={inv.role} />
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 text-amber-600 border-amber-500/30"
                        >
                          Pending
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Expires{" "}
                        {new Date(inv.expiresAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInvitationToRevoke(inv)}
                    className="h-7 px-2 text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10 self-end sm:self-center gap-1"
                  >
                    <Ban className="size-3.5" />
                    <span>Revoke</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to {currentWorkspace.name}</DialogTitle>
            <DialogDescription>
              Send an email invitation. The invitee can join whether they are
              already registered or new to TaskFlow.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInvitation} className="space-y-4">
            {inviteError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{inviteError}</span>
              </div>
            )}

            {emailDeliveryNotice && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Email Delivery Notice</p>
                  <p className="text-[11px] leading-relaxed">
                    {emailDeliveryNotice}
                  </p>
                </div>
              </div>
            )}

            {devEmailPreview ? (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Mail className="size-3.5 text-primary" />
                    <span>Email Preview</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-normal"
                    >
                      Local Dev
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant={previewTab === "html" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setPreviewTab("html")}
                      className="h-6 px-2 text-[11px]"
                    >
                      HTML
                    </Button>
                    <Button
                      type="button"
                      variant={previewTab === "text" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setPreviewTab("text")}
                      className="h-6 px-2 text-[11px]"
                    >
                      Text
                    </Button>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] bg-background/80 p-2 rounded border border-border/50 font-mono">
                  <div>
                    <span className="text-muted-foreground">Subject: </span>
                    <strong className="text-foreground font-sans">
                      {devEmailPreview.subject}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">From: </span>
                    <span>{devEmailPreview.from}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">To: </span>
                    <span>{devEmailPreview.to}</span>
                  </div>
                </div>

                {previewTab === "html" ? (
                  <div className="rounded border bg-white text-black p-3 max-h-56 overflow-y-auto shadow-inner">
                    <div
                      dangerouslySetInnerHTML={{ __html: devEmailPreview.html }}
                    />
                  </div>
                ) : (
                  <pre className="rounded border bg-background p-2.5 max-h-48 overflow-y-auto text-[11px] font-mono text-muted-foreground whitespace-pre-wrap select-all">
                    {devEmailPreview.text}
                  </pre>
                )}

                <div className="flex items-center justify-between pt-1 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyDevUrl}
                    className="h-7 text-xs gap-1.5"
                  >
                    {hasCopiedDevUrl ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>
                      {hasCopiedDevUrl ? "Copied Link" : "Copy Invite Link"}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    asChild
                    className="h-7 text-xs gap-1.5"
                  >
                    <a
                      href={devEmailPreview.inviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3" />
                      <span>Open Invite Page</span>
                    </a>
                  </Button>
                </div>
              </div>
            ) : devInviteUrl ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-amber-800 dark:text-amber-400">
                  <span>Development Preview Link</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyDevUrl}
                    className="h-6 px-2 text-[11px] gap-1"
                  >
                    {hasCopiedDevUrl ? (
                      <Check className="size-3" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>{hasCopiedDevUrl ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
                <p className="text-muted-foreground text-[11px] break-all font-mono select-all bg-background/50 p-1.5 rounded">
                  {devInviteUrl}
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label
                htmlFor="invite-email"
                className="text-xs font-medium text-foreground"
              >
                Invitee email address
              </label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isSendingInvite}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="invite-role"
                className="text-xs font-medium text-foreground"
              >
                Workspace Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "ADMIN" | "MEMBER")
                }
                disabled={isSendingInvite || !isOwner}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="MEMBER">
                  Member — Can collaborate on tasks and projects
                </option>
                {isOwner && (
                  <option value="ADMIN">
                    Admin — Can manage projects and members
                  </option>
                )}
              </select>
              {!isOwner && (
                <p className="text-[11px] text-muted-foreground">
                  Only workspace owners can invite members with the Admin role.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsInviteOpen(false);
                  setDevEmailPreview(null);
                  setDevInviteUrl(null);
                  setEmailDeliveryNotice(null);
                }}
                disabled={isSendingInvite}
              >
                {devInviteUrl || devEmailPreview ? "Done" : "Cancel"}
              </Button>
              <Button type="submit" disabled={isSendingInvite}>
                {isSendingInvite ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="size-3.5 mr-1.5" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revoke Invitation Dialog */}
      <Dialog
        open={!!invitationToRevoke}
        onOpenChange={(open) =>
          !open && !isRevoking && setInvitationToRevoke(null)
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke the invitation sent to{" "}
              <strong>{invitationToRevoke?.email}</strong>? The invitation link
              will immediately become invalid.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setInvitationToRevoke(null)}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRevokeInvitation}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Revoking...
                </>
              ) : (
                "Revoke Invitation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove / Leave Confirmation Dialog */}
      <Dialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && !isRemoving && setMemberToRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {memberToRemove?.userId === currentUser?.id
                ? "Leave Workspace"
                : "Remove Member"}
            </DialogTitle>
            <DialogDescription>
              {memberToRemove?.userId === currentUser?.id ? (
                <>
                  Are you sure you want to leave{" "}
                  <strong>{currentWorkspace.name}</strong>? You will immediately
                  lose access to all projects and tasks in this workspace.
                </>
              ) : (
                <>
                  Are you sure you want to remove{" "}
                  <strong>{memberToRemove?.user.name}</strong> from{" "}
                  <strong>{currentWorkspace.name}</strong>? They will
                  immediately lose access to this workspace. Any tasks currently
                  assigned to them will become unassigned.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {memberToRemove?.userId === currentUser?.id
                    ? "Leaving..."
                    : "Removing..."}
                </>
              ) : memberToRemove?.userId === currentUser?.id ? (
                "Leave Workspace"
              ) : (
                "Remove Member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
