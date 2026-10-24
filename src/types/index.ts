export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export type NotificationType = "TASK_ASSIGNED" | "TASK_COMMENT" | "WORKSPACE_INVITATION";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ProjectStatus = "ACTIVE" | "ARCHIVED";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type WorkspaceWithRole = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: WorkspaceRole;
  createdAt: string;
};

export type WorkspaceMemberDetails = {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

export type ProjectWithCounts = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  completedCount: number;
};

export type TaskWithRelations = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  dueDate: string | null;
  estimatedHours: number | null;
  assigneeId: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    comments: number;
  };
  priorityScore?: number;
  priorityReason?: string[];
};

export type CommentWithAuthor = {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

export type ActivityLogEntry = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  taskId: string | null;
  userId: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  task?: {
    id: string;
    title: string;
  } | null;
};

export type WorkspaceInvitationDetails = {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  invitedById: string;
  expiresAt: string;
  createdAt: string;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
  invitedBy?: {
    id: string;
    name: string;
    email: string;
  };
};

export type NotificationDetails = {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
  workspace?: {
    id: string;
    name: string;
  } | null;
};
