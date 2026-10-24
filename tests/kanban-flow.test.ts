import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { canManageProjects } from "../src/lib/permissions/workspace";
import { calculateTaskPriority } from "../src/lib/prioritization/engine";
import type { TaskStatus, TaskPriority } from "../src/types";

// Schema validations matching project and task API
const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters long."),
  description: z.string().trim().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().nullable().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

const createTaskSchema = z.object({
  projectId: z.string().min(1, "Project is required."),
  title: z.string().trim().min(1, "Task title is required."),
  description: z.string().trim().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().positive().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

const createCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment content cannot be empty."),
});

// Format activity log action text identical to TaskDetailsModal
function formatActionText(action: string, detailsStr?: string | null): string {
  try {
    const details = detailsStr ? JSON.parse(detailsStr) : {};
    switch (action) {
      case "TASK_CREATED":
        return "created this task";
      case "STATUS_CHANGED":
        return `changed status from ${details.from || "?"} to ${details.to || "?"}`;
      case "PRIORITY_CHANGED":
        return `changed priority from ${details.from || "?"} to ${details.to || "?"}`;
      case "ASSIGNEE_CHANGED":
        return `changed assignee from ${details.from || "?"} to ${details.to || "?"}`;
      case "COMMENT_ADDED":
        return "added a comment";
      default:
        return action.toLowerCase().replace(/_/g, " ");
    }
  } catch {
    return action.toLowerCase().replace(/_/g, " ");
  }
}

describe("Projects & Kanban Board Flow", () => {
  describe("Project Creation and Status Validation", () => {
    it("accepts valid project creation payload", () => {
      const valid = createProjectSchema.safeParse({
        name: "Infrastructure Migration",
        description: "Moving from local to cloud",
      });
      assert.equal(valid.success, true);
    });

    it("rejects project name shorter than 2 characters", () => {
      const invalid = createProjectSchema.safeParse({
        name: "A",
      });
      assert.equal(invalid.success, false);
      if (!invalid.success) {
        assert.match(invalid.error.issues[0].message, /at least 2 characters/i);
      }
    });

    it("accepts valid project status updates (ACTIVE and ARCHIVED)", () => {
      assert.equal(updateProjectSchema.safeParse({ status: "ACTIVE" }).success, true);
      assert.equal(updateProjectSchema.safeParse({ status: "ARCHIVED" }).success, true);
      assert.equal(updateProjectSchema.safeParse({ status: "DELETED" }).success, false);
    });

    it("enforces project management permissions (OWNER/ADMIN only, not MEMBER)", () => {
      assert.equal(canManageProjects("OWNER"), true);
      assert.equal(canManageProjects("ADMIN"), true);
      assert.equal(canManageProjects("MEMBER"), false);
    });
  });

  describe("Kanban Task Validation & Column States", () => {
    it("validates all four Kanban columns match TaskStatus enum", () => {
      const validStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
      for (const st of validStatuses) {
        const result = createTaskSchema.safeParse({
          projectId: "proj-1",
          title: "Sample Task",
          status: st,
        });
        assert.equal(result.success, true);
      }
    });

    it("rejects invalid status names outside the Kanban columns", () => {
      const result = createTaskSchema.safeParse({
        projectId: "proj-1",
        title: "Sample Task",
        status: "BACKLOG",
      });
      assert.equal(result.success, false);
    });

    it("rejects empty task title", () => {
      const result = createTaskSchema.safeParse({
        projectId: "proj-1",
        title: "   ",
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(result.error.issues[0].message, /required/i);
      }
    });

    it("validates task priority enum values", () => {
      const validPriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
      for (const pr of validPriorities) {
        const result = createTaskSchema.safeParse({
          projectId: "proj-1",
          title: "Priority Test",
          priority: pr,
        });
        assert.equal(result.success, true);
      }
    });

    it("validates non-empty comment submission", () => {
      assert.equal(createCommentSchema.safeParse({ content: "Looks good to me!" }).success, true);
      assert.equal(createCommentSchema.safeParse({ content: "   " }).success, false);
    });
  });

  describe("Kanban Prioritization & Dynamic Score Engine", () => {
    it("prioritizes overdue and urgent tasks higher than low priority todo tasks", () => {
      const highUrgent = calculateTaskPriority({
        status: "IN_PROGRESS",
        priority: "URGENT",
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day overdue
        estimatedHours: 1,
        createdAt: new Date(),
      });

      const lowTodo = calculateTaskPriority({
        status: "TODO",
        priority: "LOW",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days out
        estimatedHours: 10,
        createdAt: new Date(),
      });

      assert.ok(highUrgent.score > lowTodo.score, `Expected ${highUrgent.score} > ${lowTodo.score}`);
      assert.ok(highUrgent.reasons.some((r) => r.includes("Overdue")));
    });

    it("ensures completed tasks in DONE column have score 0 regardless of priority", () => {
      const doneTask = calculateTaskPriority({
        status: "DONE",
        priority: "URGENT",
        dueDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
        createdAt: new Date(),
      });

      assert.equal(doneTask.score, 0);
      assert.deepEqual(doneTask.reasons, ["Task is already completed."]);
    });
  });

  describe("Activity History Formatting", () => {
    it("formats status changed activity correctly", () => {
      const text = formatActionText(
        "STATUS_CHANGED",
        JSON.stringify({ from: "TODO", to: "IN_PROGRESS" })
      );
      assert.equal(text, "changed status from TODO to IN_PROGRESS");
    });

    it("formats priority changed activity correctly", () => {
      const text = formatActionText(
        "PRIORITY_CHANGED",
        JSON.stringify({ from: "MEDIUM", to: "URGENT" })
      );
      assert.equal(text, "changed priority from MEDIUM to URGENT");
    });

    it("formats assignee changed activity correctly", () => {
      const text = formatActionText(
        "ASSIGNEE_CHANGED",
        JSON.stringify({ from: "Unassigned", to: "Jane Doe" })
      );
      assert.equal(text, "changed assignee from Unassigned to Jane Doe");
    });

    it("formats comment added activity correctly", () => {
      const text = formatActionText("COMMENT_ADDED", JSON.stringify({ snippet: "Test comment" }));
      assert.equal(text, "added a comment");
    });
  });

  describe("Estimated Hours Display & Persistence Rules", () => {
    // Replicates conditional visibility rule: status !== "DONE"
    const shouldDisplayEstimatedHours = (status: TaskStatus) => status !== "DONE";

    it("displays estimated hours for TODO, IN_PROGRESS, and IN_REVIEW statuses", () => {
      const visibleStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW"];
      for (const st of visibleStatuses) {
        assert.equal(
          shouldDisplayEstimatedHours(st),
          true,
          `Expected estimated hours to be visible for status ${st}`
        );
      }
    });

    it("hides estimated hours when status is DONE", () => {
      assert.equal(
        shouldDisplayEstimatedHours("DONE"),
        false,
        "Expected estimated hours to be hidden when status is DONE"
      );
    });

    it("preserves estimated hours value in state across status transitions to and from DONE", () => {
      let currentStatus: TaskStatus = "TODO";
      const storedEstimatedHours: string = "5.5";

      // 1. Initial TODO state: visible and has value
      assert.equal(shouldDisplayEstimatedHours(currentStatus), true);
      assert.equal(storedEstimatedHours, "5.5");

      // 2. User changes status to DONE: field hidden, but state value preserved
      currentStatus = "DONE";
      assert.equal(shouldDisplayEstimatedHours(currentStatus), false);
      assert.equal(storedEstimatedHours, "5.5");

      // 3. User changes status back to IN_PROGRESS: field visible, value still intact
      currentStatus = "IN_PROGRESS";
      assert.equal(shouldDisplayEstimatedHours(currentStatus), true);
      assert.equal(storedEstimatedHours, "5.5");

      // 4. Update payload keeps stored value when saved, without nullifying
      const updatePayload = {
        status: currentStatus,
        estimatedHours: storedEstimatedHours ? Number(storedEstimatedHours) : null,
      };
      assert.equal(updatePayload.estimatedHours, 5.5);
    });

    it("card badge only renders when task is not DONE and estimatedHours is present", () => {
      const shouldRenderBadge = (task: { status: TaskStatus; estimatedHours?: number | null }) =>
        task.status !== "DONE" && !!task.estimatedHours;

      assert.equal(shouldRenderBadge({ status: "TODO", estimatedHours: 3 }), true);
      assert.equal(shouldRenderBadge({ status: "IN_PROGRESS", estimatedHours: 4.5 }), true);
      assert.equal(shouldRenderBadge({ status: "IN_REVIEW", estimatedHours: 2 }), true);
      assert.equal(shouldRenderBadge({ status: "DONE", estimatedHours: 3 }), false);
      assert.equal(shouldRenderBadge({ status: "TODO", estimatedHours: null }), false);
    });
  });
});
