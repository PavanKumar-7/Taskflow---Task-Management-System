import type { TaskPriority, TaskStatus } from "@/types";

export type PrioritizationInput = {
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | string | null;
  estimatedHours?: number | null;
  createdAt: Date | string;
};

export type PrioritizationResult = {
  score: number;
  reasons: string[];
};

export function calculateTaskPriority(input: PrioritizationInput): PrioritizationResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Completed tasks are finished and deprioritized
  if (input.status === "DONE") {
    return {
      score: 0,
      reasons: ["Task is already completed."],
    };
  }

  // 2. Base priority level weight
  switch (input.priority) {
    case "URGENT":
      score += 40;
      reasons.push("Urgent priority rating (+40 pts)");
      break;
    case "HIGH":
      score += 25;
      reasons.push("High priority rating (+25 pts)");
      break;
    case "MEDIUM":
      score += 10;
      reasons.push("Medium priority rating (+10 pts)");
      break;
    case "LOW":
      score += 2;
      reasons.push("Low priority rating (+2 pts)");
      break;
  }

  // 3. Workflow status weight
  if (input.status === "IN_PROGRESS") {
    score += 15;
    reasons.push("Currently in progress (+15 pts)");
  } else if (input.status === "IN_REVIEW") {
    score += 10;
    reasons.push("In review awaiting completion (+10 pts)");
  } else if (input.status === "TODO") {
    score += 5;
    reasons.push("Pending kickoff (+5 pts)");
  }

  // 4. Due date proximity & overdue analysis
  if (input.dueDate) {
    const now = new Date();
    const due = new Date(input.dueDate);
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const msDiff = dueDate.getTime() - nowDate.getTime();
    const daysDiff = Math.round(msDiff / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      const daysOverdue = Math.abs(daysDiff);
      const overduePenalty = Math.min(60, 40 + daysOverdue * 4);
      score += overduePenalty;
      reasons.push(`Overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} (+${overduePenalty} pts)`);
    } else if (daysDiff === 0) {
      score += 35;
      reasons.push("Due today (+35 pts)");
    } else if (daysDiff === 1) {
      score += 25;
      reasons.push("Due tomorrow (+25 pts)");
    } else if (daysDiff <= 3) {
      score += 18;
      reasons.push(`Due in ${daysDiff} days (+18 pts)`);
    } else if (daysDiff <= 7) {
      score += 10;
      reasons.push(`Due within this week (+10 pts)`);
    } else {
      score += 2;
      reasons.push("Upcoming deadline on schedule (+2 pts)");
    }
  } else {
    reasons.push("No explicit deadline set");
  }

  // 5. Quick wins heuristic (low estimated hours)
  if (input.estimatedHours != null && input.estimatedHours > 0) {
    if (input.estimatedHours <= 2) {
      score += 8;
      reasons.push("Quick win: estimated ≤ 2 hours (+8 pts)");
    } else if (input.estimatedHours <= 5) {
      score += 4;
      reasons.push("Moderate effort: estimated ≤ 5 hours (+4 pts)");
    }
  }

  return {
    score: Math.max(0, score),
    reasons,
  };
}
