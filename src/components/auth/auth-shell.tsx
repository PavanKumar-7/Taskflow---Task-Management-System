"use client";

import React from "react";
import {
  Workflow,
  Sparkles,
  LayoutGrid,
  Users2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh w-full flex flex-col lg:grid lg:grid-cols-12 bg-background text-foreground overflow-x-hidden">
      {/* Seamless subtle ambient teal/mint glow across page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 size-[32rem] rounded-full bg-teal-500/5 dark:bg-teal-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 size-[32rem] rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-3xl"
      />

      {/* LEFT SECTION: Brand & Product Introduction (Desktop/Tablet) */}
      <section
        aria-label="Product introduction"
        className="hidden lg:flex lg:col-span-6 xl:col-span-5 flex-col justify-between p-8 xl:p-12 relative"
      >
        {/* Brand header */}
        <div className="relative z-10 flex items-center gap-3 select-none">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <Workflow className="size-5" />
          </span>
          <div>
            <span className="text-lg font-bold tracking-tight text-foreground block">
              TaskFlow
            </span>
            <span className="text-xs text-muted-foreground font-medium block">
              Organize · Collaborate · Get things done
            </span>
          </div>
        </div>

        {/* Center content: Headlines, Benefits & Mockup */}
        <div className="relative z-10 my-auto py-8 space-y-7 max-w-lg">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>Modern Project Management</span>
            </div>
            <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-foreground leading-[1.18]">
              Turn your ideas into{" "}
              <span className="text-primary">progress</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              TaskFlow helps teams plan, collaborate, and deliver work that
              matters with modern visual workspaces and intelligent
              prioritization.
            </p>
          </div>

          {/* 3 Compact Benefit Items */}
          <div className="grid gap-3 pt-1">
            <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3 transition-colors">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LayoutGrid className="size-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-foreground">
                  Keep your work organized
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  Structured workspaces and visual Kanban boards tailored for
                  focused team execution.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3 transition-colors">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users2 className="size-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-foreground">
                  Work better together
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  Multi-member workspaces with secure invitations,
                  notifications, and role-based access.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3 transition-colors">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-foreground">
                  Achieve more
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  Stay aligned with smart priority scoring, automated progress
                  tracking, and activity feeds.
                </p>
              </div>
            </div>
          </div>

          {/* Decorative mini Kanban / Dashboard Preview illustration */}
          <div
            aria-hidden="true"
            className="rounded-2xl border border-border bg-card/70 p-4 shadow-xs space-y-3 select-none"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-foreground">
                  Sprint 4 · Product Launch
                </span>
              </div>
              <span className="text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                84% completed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Mini Column 1: In Progress */}
              <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3 text-blue-500" />
                    <span>In Progress</span>
                  </span>
                  <span className="text-[10px] font-mono px-1 rounded bg-background border border-border">
                    2
                  </span>
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-2 shadow-2xs space-y-1.5">
                  <span className="text-[11px] font-medium text-foreground block truncate">
                    Kanban drag &amp; drop
                  </span>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[9px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1">
                      Urgent
                    </span>
                    <span className="text-muted-foreground">Today</span>
                  </div>
                </div>
              </div>

              {/* Mini Column 2: Done */}
              <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-emerald-500" />
                    <span>Done</span>
                  </span>
                  <span className="text-[10px] font-mono px-1 rounded bg-background border border-border">
                    8
                  </span>
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-2 shadow-2xs space-y-1.5">
                  <span className="text-[11px] font-medium text-foreground block truncate line-through opacity-70">
                    Stateless JWT auth
                  </span>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1">
                      Verified
                    </span>
                    <span className="text-muted-foreground">Oct 23</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-[11px] text-muted-foreground">
          © 2026 TaskFlow. Secure workspace management.
        </div>
      </section>

      {/* RIGHT SECTION: Form Area */}
      <section
        aria-label="Authentication form"
        className="flex-1 lg:col-span-6 xl:col-span-7 flex flex-col justify-between min-h-svh p-4 sm:p-6 lg:p-8 xl:p-12 relative z-10"
      >
        {/* Top header: Mobile brand on left, ThemeToggle on right */}
        <header className="flex items-center justify-between w-full pb-4 sm:pb-6">
          <div className="flex items-center gap-2 select-none lg:invisible">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Workflow className="size-4" />
            </span>
            <span className="text-sm font-bold tracking-tight text-foreground">
              TaskFlow
            </span>
          </div>

          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        {/* Centered form card container */}
        <main className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
          {children}
        </main>

        {/* Bottom subtle copyright / links */}
        <footer className="w-full text-center py-2 text-[11px] text-muted-foreground">
          Protected by HTTPS encryption and HttpOnly cookie security.
        </footer>
      </section>
    </div>
  );
}
