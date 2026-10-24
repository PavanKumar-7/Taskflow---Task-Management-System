import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateTaskPriority } from "../src/lib/prioritization/engine";

describe("Prioritization Engine", () => {
  const baseCreatedAt = new Date().toISOString();

  it("assigns score 0 to completed tasks regardless of priority or deadline", () => {
    const result = calculateTaskPriority({
      status: "DONE",
      priority: "URGENT",
      dueDate: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days overdue
      estimatedHours: 1,
      createdAt: baseCreatedAt,
    });

    assert.equal(result.score, 0);
    assert.deepEqual(result.reasons, ["Task is already completed."]);
  });

  it("applies higher base points for higher priority levels", () => {
    const urgent = calculateTaskPriority({
      status: "TODO",
      priority: "URGENT",
      dueDate: null,
      createdAt: baseCreatedAt,
    });

    const low = calculateTaskPriority({
      status: "TODO",
      priority: "LOW",
      dueDate: null,
      createdAt: baseCreatedAt,
    });

    assert.ok(
      urgent.score > low.score,
      `Expected urgent score (${urgent.score}) to exceed low score (${low.score})`,
    );
    assert.ok(urgent.reasons.some((r) => r.includes("Urgent priority rating")));
    assert.ok(low.reasons.some((r) => r.includes("Low priority rating")));
  });

  it("boosts active tasks currently in progress over todo tasks", () => {
    const inProgress = calculateTaskPriority({
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueDate: null,
      createdAt: baseCreatedAt,
    });

    const todo = calculateTaskPriority({
      status: "TODO",
      priority: "MEDIUM",
      dueDate: null,
      createdAt: baseCreatedAt,
    });

    assert.ok(
      inProgress.score > todo.score,
      `Expected in_progress (${inProgress.score}) to be higher than todo (${todo.score})`,
    );
    assert.ok(inProgress.reasons.some((r) => r.includes("Currently in progress")));
  });

  it("scales penalty points for overdue tasks based on days overdue", () => {
    const now = Date.now();
    const oneDayOverdue = calculateTaskPriority({
      status: "TODO",
      priority: "MEDIUM",
      dueDate: new Date(now - 86400000 * 1.5),
      createdAt: baseCreatedAt,
    });

    const fiveDaysOverdue = calculateTaskPriority({
      status: "TODO",
      priority: "MEDIUM",
      dueDate: new Date(now - 86400000 * 5.5),
      createdAt: baseCreatedAt,
    });

    assert.ok(
      fiveDaysOverdue.score >= oneDayOverdue.score,
      `Expected 5 days overdue (${fiveDaysOverdue.score}) >= 1 day overdue (${oneDayOverdue.score})`,
    );
    assert.ok(fiveDaysOverdue.reasons.some((r) => r.includes("Overdue by")));
  });

  it("awards points for impending deadlines due today or tomorrow", () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const dueToday = calculateTaskPriority({
      status: "TODO",
      priority: "LOW",
      dueDate: today,
      createdAt: baseCreatedAt,
    });

    assert.ok(dueToday.reasons.some((r) => r.includes("Due today") || r.includes("Due in")));
    assert.ok(dueToday.score > 10);
  });

  it("awards quick win bonus points for small tasks estimated under 2 hours", () => {
    const quickWin = calculateTaskPriority({
      status: "TODO",
      priority: "LOW",
      dueDate: null,
      estimatedHours: 1.5,
      createdAt: baseCreatedAt,
    });

    const heavyTask = calculateTaskPriority({
      status: "TODO",
      priority: "LOW",
      dueDate: null,
      estimatedHours: 12,
      createdAt: baseCreatedAt,
    });

    assert.ok(
      quickWin.score > heavyTask.score,
      `Expected quick win (${quickWin.score}) to exceed heavy task (${heavyTask.score})`,
    );
    assert.ok(quickWin.reasons.some((r) => r.includes("Quick win")));
  });

  it("handles null and undefined due dates cleanly without crashing or NaN", () => {
    const result = calculateTaskPriority({
      status: "TODO",
      priority: "MEDIUM",
      dueDate: null,
      createdAt: baseCreatedAt,
    });

    assert.equal(typeof result.score, "number");
    assert.ok(!Number.isNaN(result.score));
    assert.ok(result.score >= 0);
    assert.ok(result.reasons.includes("No explicit deadline set"));
  });
});
