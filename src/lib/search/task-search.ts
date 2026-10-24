export type SearchableTask = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
};

export function buildTaskSearchQuery(
  searchQuery: string | null | undefined,
  workspaceId: string,
  projectId?: string | null
) {
  const trimmed = searchQuery?.trim();
  const where: {
    workspaceId: string;
    projectId?: string;
    OR?: Array<
      | { title: { contains: string; mode: "insensitive" } }
      | { description: { contains: string; mode: "insensitive" } }
    >;
  } = { workspaceId };

  if (projectId) {
    where.projectId = projectId;
  }

  if (trimmed && trimmed.length > 0) {
    where.OR = [
      { title: { contains: trimmed, mode: "insensitive" } },
      { description: { contains: trimmed, mode: "insensitive" } },
    ];
  }

  return where;
}

export function filterTasksByQuery<T extends SearchableTask>(
  tasks: T[],
  query: string | null | undefined,
  workspaceId: string,
  limit?: number
): T[] {
  const trimmed = query?.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  const matched = tasks.filter((task) => {
    if (task.workspaceId !== workspaceId) return false;
    const matchesTitle = task.title.toLowerCase().includes(trimmed);
    const matchesDesc = task.description
      ? task.description.toLowerCase().includes(trimmed)
      : false;
    return matchesTitle || matchesDesc;
  });

  return typeof limit === "number" && limit > 0 ? matched.slice(0, limit) : matched;
}
