import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateWorkspaceAnalytics,
  getDueStatus,
  type AnalyticsProject,
  type AnalyticsTask,
} from "../src/lib/analytics/calculator";

describe("Workspace Analytics & Dashboard Engine", () => {
  describe("Empty Workspaces & Default Boundaries", () => {
    it("handles an empty workspace with zero projects and zero tasks safely", () => {
      const result = calculateWorkspaceAnalytics({
        projects: [],
        tasks: [],
        memberCount: 1,
        now: new Date("2026-10-23T12:00:00Z"),
      });

      assert.equal(result.metrics.totalProjects, 0);
      assert.equal(result.metrics.activeProjects, 0);
      assert.equal(result.metrics.archivedProjects, 0);
      assert.equal(result.metrics.totalTasks, 0);
      assert.equal(result.metrics.completedTasks, 0);
      assert.equal(result.metrics.inProgressTasks, 0);
      assert.equal(result.metrics.inReviewTasks, 0);
      assert.equal(result.metrics.todoTasks, 0);
      assert.equal(result.metrics.overdueTasks, 0);
      assert.equal(result.metrics.dueSoonTasks, 0);
      assert.equal(result.metrics.completionRate, 0);
      assert.equal(result.metrics.memberCount, 1);

      assert.deepEqual(result.statusDistribution, {
        TODO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0,
      });

      assert.deepEqual(result.priorityDistribution, {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        URGENT: 0,
      });

      assert.equal(result.projectSummaries.length, 0);
      assert.equal(result.upcomingTasks.length, 0);
      assert.equal(result.topPriorityTasks.length, 0);
    });

    it("handles workspace with projects but zero tasks cleanly without NaN", () => {
      const projects: AnalyticsProject[] = [
        { id: "p1", name: "Alpha", status: "ACTIVE" },
        { id: "p2", name: "Beta", status: "ARCHIVED" },
      ];

      const result = calculateWorkspaceAnalytics({
        projects,
        tasks: [],
        memberCount: 3,
        now: new Date("2026-10-23T12:00:00Z"),
      });

      assert.equal(result.metrics.totalProjects, 2);
      assert.equal(result.metrics.activeProjects, 1);
      assert.equal(result.metrics.archivedProjects, 1);
      assert.equal(result.metrics.totalTasks, 0);
      assert.equal(result.metrics.completionRate, 0);

      assert.equal(result.projectSummaries.length, 2);
      assert.equal(result.projectSummaries[0].totalTasks, 0);
      assert.equal(result.projectSummaries[0].completedTasks, 0);
      assert.equal(result.projectSummaries[0].completionRate, 0);
    });
  });

  describe("Date Boundaries & Overdue Calculations", () => {
    const refDate = new Date("2026-10-23T12:00:00Z");

    it("correctly identifies overdue tasks due before today", () => {
      // 1 day overdue
      const pastDue = getDueStatus(new Date("2026-10-22T00:00:00Z"), "TODO", refDate);
      assert.equal(pastDue.isOverdue, true);
      assert.equal(pastDue.isDueSoon, false);
      assert.ok(pastDue.daysDiff !== null && pastDue.daysDiff < 0);

      // 5 days overdue
      const farPastDue = getDueStatus(new Date("2026-10-18T10:00:00Z"), "IN_PROGRESS", refDate);
      assert.equal(farPastDue.isOverdue, true);
      assert.equal(farPastDue.isDueSoon, false);
    });

    it("classifies tasks due today as due soon, not overdue", () => {
      const dueToday = getDueStatus(new Date("2026-10-23T23:59:59Z"), "TODO", refDate);
      assert.equal(dueToday.isOverdue, false);
      assert.equal(dueToday.isDueSoon, true);
      assert.equal(dueToday.daysDiff, 0);
    });

    it("classifies tasks due within next 7 days as due soon", () => {
      // 3 days out
      const due3Days = getDueStatus(new Date("2026-10-26T12:00:00Z"), "TODO", refDate);
      assert.equal(due3Days.isOverdue, false);
      assert.equal(due3Days.isDueSoon, true);

      // Exactly 7 days out
      const due7Days = getDueStatus(new Date("2026-10-30T12:00:00Z"), "TODO", refDate);
      assert.equal(due7Days.isOverdue, false);
      assert.equal(due7Days.isDueSoon, true);
      assert.equal(due7Days.daysDiff, 7);
    });

    it("does not classify tasks due 8 or more days out as due soon or overdue", () => {
      const due8Days = getDueStatus(new Date("2026-10-31T12:00:00Z"), "TODO", refDate);
      assert.equal(due8Days.isOverdue, false);
      assert.equal(due8Days.isDueSoon, false);
    });

    it("never marks completed (DONE) tasks as overdue or due soon regardless of deadline", () => {
      const doneOverdue = getDueStatus(new Date("2026-10-01T00:00:00Z"), "DONE", refDate);
      assert.equal(doneOverdue.isOverdue, false);
      assert.equal(doneOverdue.isDueSoon, false);
      assert.equal(doneOverdue.daysDiff, null);

      const doneDueToday = getDueStatus(new Date("2026-10-23T12:00:00Z"), "DONE", refDate);
      assert.equal(doneDueToday.isOverdue, false);
      assert.equal(doneDueToday.isDueSoon, false);
    });

    it("safely handles null, undefined, and invalid due dates without crashing", () => {
      assert.deepEqual(getDueStatus(null, "TODO", refDate), {
        isOverdue: false,
        isDueSoon: false,
        daysDiff: null,
      });
      assert.deepEqual(getDueStatus(undefined, "TODO", refDate), {
        isOverdue: false,
        isDueSoon: false,
        daysDiff: null,
      });
      assert.deepEqual(getDueStatus("invalid-date-string", "TODO", refDate), {
        isOverdue: false,
        isDueSoon: false,
        daysDiff: null,
      });
    });
  });

  describe("Aggregations & Project Summaries", () => {
    const now = new Date("2026-10-23T12:00:00Z");

    const sampleProjects: AnalyticsProject[] = [
      { id: "proj-1", name: "Frontend Portal", status: "ACTIVE" },
      { id: "proj-2", name: "Backend API", status: "ACTIVE" },
      { id: "proj-3", name: "Legacy System", status: "ARCHIVED" },
    ];

    const sampleTasks: AnalyticsTask[] = [
      // Project 1 tasks (3 tasks: 1 DONE, 1 IN_PROGRESS overdue, 1 TODO due tomorrow)
      {
        id: "t1",
        title: "Setup landing page",
        status: "DONE",
        priority: "MEDIUM",
        projectId: "proj-1",
        dueDate: "2026-10-15T00:00:00Z", // Past due, but DONE -> not overdue
        createdAt: "2026-10-01T00:00:00Z",
      },
      {
        id: "t2",
        title: "Fix auth form regression",
        status: "IN_PROGRESS",
        priority: "URGENT",
        projectId: "proj-1",
        dueDate: "2026-10-20T00:00:00Z", // Past due and IN_PROGRESS -> OVERDUE
        createdAt: "2026-10-01T00:00:00Z",
      },
      {
        id: "t3",
        title: "Add dark mode toggle",
        status: "TODO",
        priority: "LOW",
        projectId: "proj-1",
        dueDate: "2026-10-24T00:00:00Z", // Due tomorrow -> DUE SOON
        createdAt: "2026-10-01T00:00:00Z",
      },

      // Project 2 tasks (2 tasks: 2 DONE)
      {
        id: "t4",
        title: "PostgreSQL setup",
        status: "DONE",
        priority: "HIGH",
        projectId: "proj-2",
        dueDate: null,
        createdAt: "2026-10-01T00:00:00Z",
      },
      {
        id: "t5",
        title: "Prisma schema migration",
        status: "DONE",
        priority: "HIGH",
        projectId: "proj-2",
        dueDate: null,
        createdAt: "2026-10-01T00:00:00Z",
      },

      // Project 3 tasks (Archived project, 1 IN_REVIEW task)
      {
        id: "t6",
        title: "Archive old records",
        status: "IN_REVIEW",
        priority: "MEDIUM",
        projectId: "proj-3",
        dueDate: "2026-10-28T00:00:00Z", // 5 days out -> DUE SOON
        createdAt: "2026-10-01T00:00:00Z",
      },
    ];

    it("computes accurate project and task metrics", () => {
      const result = calculateWorkspaceAnalytics({
        projects: sampleProjects,
        tasks: sampleTasks,
        memberCount: 4,
        now,
      });

      // Projects
      assert.equal(result.metrics.totalProjects, 3);
      assert.equal(result.metrics.activeProjects, 2);
      assert.equal(result.metrics.archivedProjects, 1);

      // Tasks
      assert.equal(result.metrics.totalTasks, 6);
      assert.equal(result.metrics.completedTasks, 3);
      assert.equal(result.metrics.inProgressTasks, 1);
      assert.equal(result.metrics.inReviewTasks, 1);
      assert.equal(result.metrics.todoTasks, 1);
      assert.equal(result.metrics.completionRate, 50); // 3 of 6 = 50%

      // Status breakdown
      assert.equal(result.statusDistribution.TODO, 1);
      assert.equal(result.statusDistribution.IN_PROGRESS, 1);
      assert.equal(result.statusDistribution.IN_REVIEW, 1);
      assert.equal(result.statusDistribution.DONE, 3);

      // Priority breakdown
      assert.equal(result.priorityDistribution.URGENT, 1);
      assert.equal(result.priorityDistribution.HIGH, 2);
      assert.equal(result.priorityDistribution.MEDIUM, 2);
      assert.equal(result.priorityDistribution.LOW, 1);

      // Overdue and Due soon
      assert.equal(result.metrics.overdueTasks, 1); // t2 only (t1 is DONE)
      assert.equal(result.metrics.dueSoonTasks, 2); // t3 and t6
    });

    it("calculates individual project summaries with accurate progress rates", () => {
      const result = calculateWorkspaceAnalytics({
        projects: sampleProjects,
        tasks: sampleTasks,
        memberCount: 4,
        now,
      });

      const p1 = result.projectSummaries.find((p) => p.id === "proj-1");
      assert.ok(p1);
      assert.equal(p1.name, "Frontend Portal");
      assert.equal(p1.status, "ACTIVE");
      assert.equal(p1.totalTasks, 3);
      assert.equal(p1.completedTasks, 1);
      assert.equal(p1.completionRate, 33); // 1 of 3 = 33%

      const p2 = result.projectSummaries.find((p) => p.id === "proj-2");
      assert.ok(p2);
      assert.equal(p2.name, "Backend API");
      assert.equal(p2.status, "ACTIVE");
      assert.equal(p2.totalTasks, 2);
      assert.equal(p2.completedTasks, 2);
      assert.equal(p2.completionRate, 100); // 2 of 2 = 100%

      const p3 = result.projectSummaries.find((p) => p.id === "proj-3");
      assert.ok(p3);
      assert.equal(p3.name, "Legacy System");
      assert.equal(p3.status, "ARCHIVED");
      assert.equal(p3.totalTasks, 1);
      assert.equal(p3.completedTasks, 0);
      assert.equal(p3.completionRate, 0);
    });

    it("ranks urgent pending tasks at the top of priority focus", () => {
      const result = calculateWorkspaceAnalytics({
        projects: sampleProjects,
        tasks: sampleTasks,
        memberCount: 4,
        now,
      });

      assert.ok(result.topPriorityTasks.length > 0);
      // The urgent overdue task should be highest priority
      const topTask = result.topPriorityTasks[0];
      assert.equal(topTask.id, "t2");
      assert.equal(topTask.priority, "URGENT");
      assert.ok(topTask.priorityScore > 50);
      assert.ok(topTask.priorityReason.some((r) => r.includes("Urgent")));
    });
  });

  describe("Workspace Isolation", () => {
    it("ensures tasks and projects belonging to distinct workspaces remain isolated", () => {
      const wsATasks: AnalyticsTask[] = [
        {
          id: "task-ws-a",
          title: "Workspace A Task",
          status: "TODO",
          priority: "HIGH",
          projectId: "proj-ws-a",
          createdAt: new Date(),
        },
      ];

      const wsBTasks: AnalyticsTask[] = [
        {
          id: "task-ws-b",
          title: "Workspace B Task",
          status: "DONE",
          priority: "LOW",
          projectId: "proj-ws-b",
          createdAt: new Date(),
        },
      ];

      const wsAProjects: AnalyticsProject[] = [
        { id: "proj-ws-a", name: "Workspace A Project", status: "ACTIVE" },
      ];

      const resultA = calculateWorkspaceAnalytics({
        projects: wsAProjects,
        tasks: wsATasks,
        memberCount: 1,
      });

      assert.equal(resultA.metrics.totalTasks, 1);
      assert.equal(resultA.metrics.completedTasks, 0);
      assert.equal(resultA.metrics.completionRate, 0);
      assert.equal(resultA.projectSummaries[0].name, "Workspace A Project");

      const resultB = calculateWorkspaceAnalytics({
        projects: [{ id: "proj-ws-b", name: "Workspace B Project", status: "ACTIVE" }],
        tasks: wsBTasks,
        memberCount: 2,
      });

      assert.equal(resultB.metrics.totalTasks, 1);
      assert.equal(resultB.metrics.completedTasks, 1);
      assert.equal(resultB.metrics.completionRate, 100);
      assert.equal(resultB.projectSummaries[0].name, "Workspace B Project");
    });
  });
});
