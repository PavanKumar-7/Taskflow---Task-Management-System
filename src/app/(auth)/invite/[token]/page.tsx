"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Mail,
  Shield,
  ShieldCheck,
  UserPlus,
  LogIn,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type InvitationData = {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  inviterName: string;
};

function InviteAcceptContent() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      if (!token) return;

      try {
        const [inviteRes, authRes] = await Promise.all([
          fetch(`/api/v1/invitations/${token}`, { cache: "no-store" }),
          fetch(`/api/v1/auth/me`, { cache: "no-store" }).catch(() => null),
        ]);

        const inviteJson = await inviteRes.json();
        if (ignore) return;

        if (!inviteRes.ok || !inviteJson.success) {
          setError(
            inviteJson.error?.message || "Invalid or expired invitation link.",
          );
          return;
        }

        setInvitation(inviteJson.data);

        if (authRes && authRes.ok) {
          const authJson = await authRes.json().catch(() => null);
          if (!ignore && authJson?.success && authJson.data?.user) {
            setCurrentUser(authJson.data.user);
          }
        }
      } catch {
        if (!ignore) {
          setError("Network error loading invitation.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    setIsAccepting(true);
    try {
      const res = await fetch(`/api/v1/invitations/${token}/accept`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to accept invitation.");
        return;
      }

      toast.success(json.data?.message || "Invitation accepted!");
      router.push("/workspaces");
    } catch {
      toast.error("Network error accepting invitation.");
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-md shadow-xs border border-border bg-card rounded-2xl p-8 text-center">
        <Loader2 className="size-8 animate-spin mx-auto text-primary mb-3" />
        <p className="text-sm font-medium text-foreground">
          Verifying invitation...
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Please wait a moment.
        </p>
      </Card>
    );
  }

  if (error || !invitation) {
    return (
      <Card className="w-full max-w-md shadow-xs border border-border bg-card rounded-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex size-12 mx-auto items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
            <AlertCircle className="size-6" />
          </div>
          <CardTitle className="text-xl">Invitation Unavailable</CardTitle>
          <CardDescription>
            {error || "This invitation could not be loaded."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-4 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/login">Return to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // If already accepted, revoked, or expired
  if (invitation.status !== "PENDING") {
    return (
      <Card className="w-full max-w-md shadow-xs border border-border bg-card rounded-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex size-12 mx-auto items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
            <Clock className="size-6" />
          </div>
          <CardTitle className="text-xl">
            Invitation {invitation.status.toLowerCase()}
          </CardTitle>
          <CardDescription>
            {invitation.status === "ACCEPTED" &&
              "This invitation has already been accepted and is no longer valid."}
            {invitation.status === "REVOKED" &&
              "This invitation was revoked by a workspace administrator."}
            {invitation.status === "EXPIRED" &&
              "This invitation has expired. Please ask for a new invitation to be sent."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-4 flex justify-center">
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const isEmailMatch =
    currentUser &&
    currentUser.email.toLowerCase() === invitation.email.toLowerCase();

  return (
    <Card className="w-full max-w-md shadow-xs border border-border bg-card rounded-2xl">
      <CardHeader className="text-center pb-3">
        <div className="flex size-10 mx-auto items-center justify-center rounded-xl bg-primary/10 text-primary mb-2 select-none">
          <Building2 className="size-5" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Join {invitation.workspace.name}
        </CardTitle>
        <CardDescription className="text-xs">
          <strong>{invitation.inviterName}</strong> invited you to collaborate
          on TaskFlow.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Workspace</span>
            <span className="font-semibold text-foreground">
              {invitation.workspace.name}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Invited Role</span>
            <Badge variant="secondary" className="gap-1 text-xs">
              {invitation.role === "ADMIN" ? (
                <>
                  <ShieldCheck className="size-3 text-blue-500" />
                  <span>Admin</span>
                </>
              ) : (
                <>
                  <Shield className="size-3 text-muted-foreground" />
                  <span>Member</span>
                </>
              )}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Invited Email</span>
            <span className="font-mono text-foreground flex items-center gap-1">
              <Mail className="size-3 text-muted-foreground" />
              {invitation.email}
            </span>
          </div>
        </div>

        {/* State 1: Logged in with matching email */}
        {currentUser && isEmailMatch && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>You are logged in as {currentUser.email}.</span>
            </div>
            <Button
              onClick={handleAccept}
              disabled={isAccepting}
              className="w-full h-10 text-sm font-semibold rounded-lg bg-primary hover:bg-[#0F766E] text-primary-foreground shadow-xs transition-colors"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Joining Workspace...
                </>
              ) : (
                `Accept & Join ${invitation.workspace.name}`
              )}
            </Button>
          </div>
        )}

        {/* State 2: Logged in with a different email */}
        {currentUser && !isEmailMatch && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-400">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Account email mismatch</p>
                <p className="mt-0.5 leading-relaxed">
                  You are logged in as <strong>{currentUser.email}</strong>, but
                  this invitation was sent to{" "}
                  <strong>{invitation.email}</strong>.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Please log out and sign in with{" "}
              <strong>{invitation.email}</strong> to accept.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="w-full text-xs">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
              <Button asChild variant="default" className="w-full text-xs">
                <Link href="/login">Switch Account</Link>
              </Button>
            </div>
          </div>
        )}

        {/* State 3: Not logged in */}
        {!currentUser && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground text-center">
              Create an account or log in with{" "}
              <strong>{invitation.email}</strong> to accept this invitation.
            </p>

            <Button
              asChild
              className="w-full h-10 text-sm font-semibold rounded-lg bg-primary hover:bg-[#0F766E] text-primary-foreground shadow-xs transition-colors gap-2"
            >
              <Link
                href={`/register?invite=${token}&email=${encodeURIComponent(invitation.email)}`}
              >
                <UserPlus className="size-4" />
                <span>Create an account to join</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full h-10 text-sm font-medium rounded-lg border-border bg-background hover:bg-muted text-foreground shadow-xs transition-colors gap-2"
            >
              <Link href={`/login?redirect=/invite/${token}`}>
                <LogIn className="size-4" />
                <span>Log in with existing account</span>
              </Link>
            </Button>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 pb-4 text-center">
        <p className="text-[11px] text-muted-foreground/80 w-full">
          Invitations expire after 7 days from when they are sent.
        </p>
      </CardFooter>
    </Card>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full max-w-md shadow-xs border border-border bg-card rounded-2xl p-8 text-center">
          <Loader2 className="size-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm font-medium text-foreground">
            Loading invitation...
          </p>
        </Card>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  );
}
