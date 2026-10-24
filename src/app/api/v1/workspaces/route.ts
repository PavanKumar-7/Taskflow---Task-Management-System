import { z } from "zod";
import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/permissions/workspace";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters long."),
});

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const rand = Math.random().toString(36).substring(2, 7);
  return `${base || "workspace"}-${rand}`;
}

export async function GET() {
  try {
    const user = await requireAuth();

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                projects: true,
                tasks: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      ownerId: m.workspace.ownerId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      counts: m.workspace._count,
    }));

    return jsonSuccess(workspaces);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Authentication required")) {
      return jsonError("UNAUTHENTICATED", "Authentication required.");
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to fetch workspaces.")
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = createWorkspaceSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message || "Invalid workspace name.");
    }

    const { name } = parsed.data;
    const slug = generateSlug(name);

    const workspace = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          name,
          slug,
          ownerId: user.id,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: created.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      // Default starter project
      const initialProject = await tx.project.create({
        data: {
          workspaceId: created.id,
          name: "General",
          description: "Default project",
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId: created.id,
          projectId: initialProject.id,
          userId: user.id,
          action: "WORKSPACE_CREATED",
          details: JSON.stringify({ name }),
        },
      });

      return created;
    });

    return jsonSuccess(
      {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        ownerId: workspace.ownerId,
        role: "OWNER",
      },
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("Authentication required")) {
      return jsonError("UNAUTHENTICATED", "Authentication required.");
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to create workspace.")
    );
  }
}
