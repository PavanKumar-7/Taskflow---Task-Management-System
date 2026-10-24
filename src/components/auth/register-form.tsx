"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const initialEmail = searchParams.get("email") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError("Name must be at least 2 characters long.");
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
          workspaceName: workspaceName.trim() || undefined,
          inviteToken: inviteToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg =
          data.error?.message ||
          (res.status === 409
            ? "An account with this email already exists."
            : "Failed to register account.");
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      toast.success(
        inviteToken
          ? "Account created and invitation accepted!"
          : "Account created successfully!",
      );
      router.push(inviteToken ? "/workspaces" : "/dashboard");
      router.refresh();
    } catch {
      const errorMsg =
        "Network error. Please check your connection and try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xs border border-border bg-card rounded-2xl">
      <CardHeader className="space-y-1.5 pb-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2 select-none">
          <Workflow className="size-5" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          {inviteToken ? "Join your team" : "Create an account"}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground leading-normal">
          {inviteToken
            ? "Complete registration to accept your workspace invitation."
            : "Get started with TaskFlow to organize projects and collaborate."}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-3.5 pt-2">
          {inviteToken && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
              <Building2 className="size-4 shrink-0" />
              <span>You are accepting an invitation to join a workspace.</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="text-xs font-semibold text-foreground flex items-center justify-between"
            >
              <span>Full name</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <User className="size-4" />
              </div>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                required
                className="h-10 pl-9.5 pr-3 text-sm rounded-lg"
              />
            </div>
          </div>

          {/* Email address */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-foreground flex items-center justify-between"
            >
              <span>Email address</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Mail className="size-4" />
              </div>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || !!initialEmail}
                required
                className="h-10 pl-9.5 pr-3 text-sm rounded-lg"
              />
            </div>
            {initialEmail && (
              <p className="text-[11px] text-muted-foreground">
                Locked to the invited email address.
              </p>
            )}
          </div>

          {/* Password with toggle */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Lock className="size-4" />
              </div>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="h-10 pl-9.5 pr-10 text-sm rounded-lg"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Optional workspace name */}
          {!inviteToken && (
            <div className="space-y-1.5">
              <label
                htmlFor="workspaceName"
                className="text-xs font-semibold text-foreground"
              >
                Initial workspace name{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Building2 className="size-4" />
                </div>
                <Input
                  id="workspaceName"
                  name="workspaceName"
                  type="text"
                  placeholder="e.g. Acme Marketing"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  disabled={isLoading}
                  className="h-10 pl-9.5 pr-3 text-sm rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Full-width Teal Primary Action */}
          <Button
            type="submit"
            className="w-full h-10 mt-2 text-sm font-semibold rounded-lg bg-primary hover:bg-[#0F766E] text-primary-foreground shadow-xs transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                <span>Creating account...</span>
              </>
            ) : inviteToken ? (
              "Accept Invite & Register"
            ) : (
              "Create account"
            )}
          </Button>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-border pt-4 pb-3">
          <p className="text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={
                inviteToken
                  ? `/login?redirect=/invite/${inviteToken}`
                  : "/login"
              }
              className="font-semibold text-primary hover:text-teal-700 dark:hover:text-teal-400 underline-offset-4 hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
