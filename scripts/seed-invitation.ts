/**
 * Development-only invitation seed script.
 * Strictly forbidden in production.
 *
 * Usage:
 *   npx tsx scripts/seed-invitation.ts <recipientEmail> [role: MEMBER|ADMIN] [workspaceIdOrSlug]
 */

import { loadEnvConfig } from "@next/env";

// 1. Refuse to run in production
if (process.env.NODE_ENV === "production") {
  console.error("FATAL: seed-invitation is strictly forbidden in production environments.");
  process.exit(1);
}

// Load Next.js local environment variables (.env.local)
loadEnvConfig(process.cwd());

import { prisma } from "../src/lib/db";
import {
  generateInvitationToken,
  getInvitationExpiryDate,
  isInvitationExpired,
} from "../src/lib/invitations/crypto";
import { sendWorkspaceInvitationEmail } from "../src/lib/email/service";
import { createNotification } from "../src/lib/notifications/service";

async function main() {
  const args = process.argv.slice(2);
  const targetEmail = args[0]?.trim();
  const roleInput = args[1]?.trim().toUpperCase();
  const role = roleInput === "ADMIN" ? "ADMIN" : "MEMBER";
  const workspaceIdentifier = args[2]?.trim();

  if (!targetEmail || !targetEmail.includes("@")) {
    console.log(`
TaskFlow — Development Invitation Seed Tool
===========================================
Usage:
  npx tsx scripts/seed-invitation.ts <recipient-email> [role] [workspace-id-or-slug]

Examples:
  npx tsx scripts/seed-invitation.ts colleague@example.com MEMBER
  npx tsx scripts/seed-invitation.ts teamlead@gmail.com ADMIN my-workspace-slug
`);
    process.exit(1);
  }

  const normalizedEmail = targetEmail.toLowerCase();

  // Find workspace
  let workspace;
  if (workspaceIdentifier) {
    workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceIdentifier }, { slug: workspaceIdentifier }],
      },
    });
  } else {
    workspace = await prisma.workspace.findFirst({
      orderBy: { createdAt: "asc" },
    });
  }

  if (!workspace) {
    console.error("Error: No suitable workspace found in the database. Please create a workspace first.");
    process.exit(1);
  }

  const owner = (await prisma.user.findUnique({
    where: { id: workspace.ownerId },
    select: { id: true, name: true, email: true },
  })) ?? {
    id: workspace.ownerId,
    name: "Workspace Owner",
    email: "owner@taskflow.dev",
  };

  console.log(`Selected Workspace: "${workspace.name}" (ID: ${workspace.id})`);
  console.log(`Inviter: "${owner.name}" (${owner.email})`);
  console.log(`Invited Recipient: ${normalizedEmail} (Role: ${role})`);

  // Check existing membership
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true },
  });

  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: existingUser.id,
        },
      },
    });

    if (existingMember) {
      console.error(`Refusal: User "${normalizedEmail}" is already a member of workspace "${workspace.name}".`);
      process.exit(1);
    }
  }

  // Check duplicate pending invitations
  const existingInvitation = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId: workspace.id,
      email: normalizedEmail,
      status: "PENDING",
    },
  });

  if (existingInvitation) {
    if (isInvitationExpired(existingInvitation.expiresAt)) {
      await prisma.workspaceInvitation.update({
        where: { id: existingInvitation.id },
        data: { status: "EXPIRED" },
      });
    } else {
      console.error(
        `Refusal: A pending invitation has already been sent to "${normalizedEmail}" for this workspace.`
      );
      process.exit(1);
    }
  }

  // Cryptographically secure token & SHA-256 hash
  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = getInvitationExpiryDate(7);

  // Store in database (ONLY storing tokenHash, never raw token)
  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: workspace.id,
      email: normalizedEmail,
      role,
      tokenHash,
      invitedById: owner.id,
      expiresAt,
      status: "PENDING",
    },
  });

  // Dispatch through configured provider layer (Gmail SMTP, Resend, or Local Preview)
  const emailResult = await sendWorkspaceInvitationEmail({
    to: normalizedEmail,
    inviterName: owner.name,
    workspaceName: workspace.name,
    role,
    rawToken,
  });

  // Send in-app notification if user already exists
  if (existingUser) {
    await createNotification({
      userId: existingUser.id,
      workspaceId: workspace.id,
      type: "WORKSPACE_INVITATION",
      title: "Workspace Invitation",
      message: `${owner.name} invited you to join "${workspace.name}" as ${role === "ADMIN" ? "Admin" : "Member"}`,
      link: `/invite/${rawToken}`,
    });
  }

  // Record audit log
  await prisma.activityLog.create({
    data: {
      workspaceId: workspace.id,
      userId: owner.id,
      action: "INVITATION_SENT",
      details: JSON.stringify({
        recipientEmail: normalizedEmail,
        role,
        outcome: emailResult.outcome,
        provider: emailResult.provider,
        emailAccepted: emailResult.sent,
      }),
    },
  });

  console.log("\n------------------------------------------------------------");
  console.log("Invitation Created Successfully!");
  console.log("------------------------------------------------------------");
  console.log(`Database Record ID: ${invitation.id}`);
  console.log(`Status: ${invitation.status}`);
  console.log(`Expires At: ${invitation.expiresAt.toISOString()}`);
  console.log(`Email Provider: ${emailResult.provider}`);
  console.log(`Email Outcome: ${emailResult.outcome.toUpperCase()}`);

  if (emailResult.sent) {
    console.log(`Result: Email accepted by ${emailResult.provider} provider.`);
    console.log(`Please check the inbox of: ${normalizedEmail}`);
  } else if (emailResult.outcome === "preview") {
    console.log("Result: Captured in local development preview mode (no real email was sent).");
  } else {
    console.log(`Result: Email sending failed: ${emailResult.error}`);
  }

  if (emailResult.devInviteUrl) {
    console.log("\nLocal Test Instructions:");
    console.log("To accept this invitation without checking an external inbox, open:");
    console.log(`--> ${emailResult.devInviteUrl}`);
    console.log("(Tip: Open in an incognito window to simulate accepting as a new or invited user)");
  }
  console.log("------------------------------------------------------------\n");
}

main()
  .catch((err) => {
    console.error("Seed script failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
