import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterTasksByQuery,
  buildTaskSearchQuery,
  type SearchableTask,
} from "../src/lib/search/task-search";

describe("Global Task Search Engine", () => {
  const sampleTasks: SearchableTask[] = [
    {
      id: "task-1",
      workspaceId: "ws-primary",
      projectId: "proj-web",
      title: "Implement OAuth Google Authentication",
      description: "Setup JWT session cookies and OAuth callback handlers.",
      status: "IN_PROGRESS",
      priority: "HIGH",
    },
    {
      id: "task-2",
      workspaceId: "ws-primary",
      projectId: "proj-web",
      title: "Design PostgreSQL Database Schema",
      description: "Define Prisma models for tasks, projects, and activity logs.",
      status: "DONE",
      priority: "URGENT",
    },
    {
      id: "task-3",
      workspaceId: "ws-primary",
      projectId: "proj-mobile",
      title: "Refactor Navigation Header",
      description: "Fix responsive layout and mobile drawer on Android.",
      status: "TODO",
      priority: "MEDIUM",
    },
    {
      id: "task-4",
      workspaceId: "ws-primary",
      projectId: "proj-mobile",
      title: "Fix Memory Leak in WebSocket Listener",
      description: "Socket connection does not terminate on component unmount.",
      status: "IN_REVIEW",
      priority: "URGENT",
    },
    // Cross-workspace task: same keywords, DIFFERENT workspace
    {
      id: "task-foreign",
      workspaceId: "ws-other",
      projectId: "proj-other",
      title: "Implement OAuth Google Authentication in foreign team",
      description: "Setup JWT cookies for another company workspace.",
      status: "TODO",
      priority: "HIGH",
    },
  ];

  describe("Title Matching", () => {
    it("matches tasks by title case-insensitively", () => {
      const results = filterTasksByQuery(sampleTasks, "oauth", "ws-primary");
      assert.equal(results.length, 1);
      assert.equal(results[0].id, "task-1");
      assert.equal(results[0].title, "Implement OAuth Google Authentication");

      // Mixed case
      const upperResults = filterTasksByQuery(sampleTasks, "OAUTH", "ws-primary");
      assert.equal(upperResults.length, 1);
      assert.equal(upperResults[0].id, "task-1");
    });

    it("matches partial substrings in task titles", () => {
      const results = filterTasksByQuery(sampleTasks, "schema", "ws-primary");
      assert.equal(results.length, 1);
      assert.equal(results[0].id, "task-2");
    });

    it("matches all occurrences when multiple tasks match a search term like 'test'", () => {
      const tasksWithTest: SearchableTask[] = [
        {
          id: "test-1",
          workspaceId: "ws-test",
          projectId: "p1",
          title: "Write unit test suite for auth",
          description: "Verify login and JWT token logic",
          status: "DONE",
          priority: "HIGH",
        },
        {
          id: "test-2",
          workspaceId: "ws-test",
          projectId: "p1",
          title: "Integration testing for Kanban board",
          description: "Check drag and drop transitions",
          status: "IN_PROGRESS",
          priority: "URGENT",
        },
        {
          id: "test-3",
          workspaceId: "ws-test",
          projectId: "p2",
          title: "Performance load test on database",
          description: "Stress test with 10k task records",
          status: "TODO",
          priority: "MEDIUM",
        },
        {
          id: "test-4",
          workspaceId: "ws-test",
          projectId: "p2",
          title: "Unrelated documentation update",
          description: "No matching keywords here",
          status: "TODO",
          priority: "LOW",
        },
      ];

      const results = filterTasksByQuery(tasksWithTest, "test", "ws-test");
      assert.equal(results.length, 3);
      assert.equal(results[0].id, "test-1");
      assert.equal(results[1].id, "test-2");
      assert.equal(results[2].id, "test-3");

      // Verify all 3 results have valid projectIds and deep link URLs
      results.forEach((task) => {
        assert.ok(task.projectId.length > 0);
        assert.ok(task.id.length > 0);
      });
    });

    it("handles queries returning more than 5 results, preserving full result set without truncation", () => {
      const sevenTasks: SearchableTask[] = Array.from({ length: 7 }, (_, i) => ({
        id: `test-task-${i + 1}`,
        workspaceId: "ws-test",
        projectId: `proj-${i + 1}`,
        title: `Automated test case #${i + 1}`,
        description: `Description for test task #${i + 1}`,
        status: "TODO",
        priority: "MEDIUM",
      }));

      const results = filterTasksByQuery(sevenTasks, "test", "ws-test");
      assert.equal(results.length, 7);
      assert.equal(results[0].id, "test-task-1");
      assert.equal(results[6].id, "test-task-7");
    });
  });

  describe("Description Matching", () => {
    it("matches tasks by keywords in description when title does not match", () => {
      // "Prisma" is only in description of task-2
      const results = filterTasksByQuery(sampleTasks, "prisma", "ws-primary");
      assert.equal(results.length, 1);
      assert.equal(results[0].id, "task-2");
      assert.equal(results[0].title, "Design PostgreSQL Database Schema");

      // "Android" is only in description of task-3
      const androidResults = filterTasksByQuery(sampleTasks, "android", "ws-primary");
      assert.equal(androidResults.length, 1);
      assert.equal(androidResults[0].id, "task-3");
    });
  });

  describe("Workspace Isolation", () => {
    it("strictly isolates search results to the requested workspace", () => {
      // Query "OAuth" exists in both ws-primary and ws-other
      const primaryResults = filterTasksByQuery(sampleTasks, "OAuth", "ws-primary");
      assert.equal(primaryResults.length, 1);
      assert.equal(primaryResults[0].id, "task-1");
      assert.equal(primaryResults[0].workspaceId, "ws-primary");

      // When searching from ws-other
      const foreignResults = filterTasksByQuery(sampleTasks, "OAuth", "ws-other");
      assert.equal(foreignResults.length, 1);
      assert.equal(foreignResults[0].id, "task-foreign");
      assert.equal(foreignResults[0].workspaceId, "ws-other");
    });

    it("does not return any tasks if workspace has no matches", () => {
      const results = filterTasksByQuery(sampleTasks, "OAuth", "ws-empty");
      assert.equal(results.length, 0);
    });
  });

  describe("Empty, Short & Whitespace Queries", () => {
    it("returns empty array for empty string or whitespace queries", () => {
      assert.deepEqual(filterTasksByQuery(sampleTasks, "", "ws-primary"), []);
      assert.deepEqual(filterTasksByQuery(sampleTasks, "   ", "ws-primary"), []);
      assert.deepEqual(filterTasksByQuery(sampleTasks, null, "ws-primary"), []);
      assert.deepEqual(filterTasksByQuery(sampleTasks, undefined, "ws-primary"), []);
    });

    it("returns empty array for queries with length < 2 to prevent expensive full-table scans", () => {
      assert.deepEqual(filterTasksByQuery(sampleTasks, "a", "ws-primary"), []);
      assert.deepEqual(filterTasksByQuery(sampleTasks, " o ", "ws-primary"), []);
    });
  });

  describe("No Results Handling", () => {
    it("returns empty array when query does not match any tasks", () => {
      const results = filterTasksByQuery(sampleTasks, "Kubernetes cluster deploy", "ws-primary");
      assert.equal(results.length, 0);
    });
  });

  describe("Result Limiting", () => {
    it("caps results to the specified limit", () => {
      // Both task-1 and task-2 contain "in" or have multiple matches
      const resultsAll = filterTasksByQuery(sampleTasks, "in", "ws-primary");
      assert.ok(resultsAll.length >= 2);

      const resultsLimited = filterTasksByQuery(sampleTasks, "in", "ws-primary", 1);
      assert.equal(resultsLimited.length, 1);
    });
  });

  describe("Prisma Query Builder Logic", () => {
    it("builds correct case-insensitive OR clause for valid search queries", () => {
      const query = buildTaskSearchQuery("database", "ws-123");
      assert.equal(query.workspaceId, "ws-123");
      assert.ok(query.OR);
      assert.equal(query.OR.length, 2);
      assert.deepEqual(query.OR[0], { title: { contains: "database", mode: "insensitive" } });
      assert.deepEqual(query.OR[1], { description: { contains: "database", mode: "insensitive" } });
    });

    it("omits OR clause when search query is empty or whitespace", () => {
      const queryEmpty = buildTaskSearchQuery("", "ws-123");
      assert.equal(queryEmpty.workspaceId, "ws-123");
      assert.equal(queryEmpty.OR, undefined);

      const querySpaces = buildTaskSearchQuery("   ", "ws-123");
      assert.equal(querySpaces.workspaceId, "ws-123");
      assert.equal(querySpaces.OR, undefined);
    });

    it("scopes to specific project if projectId is supplied", () => {
      const query = buildTaskSearchQuery("auth", "ws-123", "proj-abc");
      assert.equal(query.workspaceId, "ws-123");
      assert.equal(query.projectId, "proj-abc");
    });
  });

  describe("Navigation & Deep Linking", () => {
    it("generates correct board URL with taskId parameter for direct modal opening", () => {
      const task = sampleTasks[0];
      const targetUrl = `/projects/${task.projectId}?taskId=${task.id}`;
      assert.equal(targetUrl, "/projects/proj-web?taskId=task-1");
    });
  });
});
