import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type TelegramProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  healthScore: number;
  healthLabel: string;
  timezone: string;
  chatTitle: string | null;
  chatType: string | null;
  memberRole: string;
  memberCount: number;
  taskCount: number;
  completedTaskCount: number;
  assignedTaskCount: number;
  pendingReviewCount: number;
  updatedAt: string;
};

export type TelegramDashboardData = {
  projects: TelegramProjectSummary[];
  totalTasks: number;
  assignedTasks: number;
  pendingReviews: number;
};

type MembershipRow = {
  project_id: string;
  role: string;
};

function requireAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Supabase server credentials are not configured.");
  }
  return admin;
}

export async function getTelegramDashboardData(
  telegramUserRecordId: string,
): Promise<TelegramDashboardData> {
  const admin = requireAdmin();
  const { data: membershipData, error: membershipError } = await admin
    .from("taskgoblin_project_members")
    .select("project_id, role")
    .eq("telegram_user_id", telegramUserRecordId);

  if (membershipError) throw membershipError;
  const memberships = (membershipData ?? []) as MembershipRow[];
  const projectIds = memberships.map((membership) => membership.project_id);

  if (projectIds.length === 0) {
    return { projects: [], totalTasks: 0, assignedTasks: 0, pendingReviews: 0 };
  }

  const [projectsResult, chatsResult, membersResult, tasksResult, reviewsResult] =
    await Promise.all([
      admin
        .from("taskgoblin_projects")
        .select(
          "id, name, description, health_score, health_label, timezone, updated_at",
        )
        .in("id", projectIds),
      admin
        .from("taskgoblin_telegram_chats")
        .select("project_id, title, chat_type")
        .in("project_id", projectIds)
        .eq("is_active", true),
      admin
        .from("taskgoblin_project_members")
        .select("project_id")
        .in("project_id", projectIds),
      admin
        .from("taskgoblin_tasks")
        .select("project_id, status, owner_telegram_user_id")
        .in("project_id", projectIds),
      admin
        .from("taskgoblin_project_event_candidates")
        .select("project_id, state")
        .in("project_id", projectIds)
        .in("state", ["detected", "awaiting_confirmation"]),
    ]);

  const firstError = [
    projectsResult,
    chatsResult,
    membersResult,
    tasksResult,
    reviewsResult,
  ].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const membershipByProject = new Map(
    memberships.map((membership) => [membership.project_id, membership]),
  );
  const chatByProject = new Map(
    (chatsResult.data ?? []).map((chat) => [chat.project_id, chat]),
  );
  const countFor = <T extends { project_id: string }>(
    rows: T[],
    projectId: string,
    predicate: (row: T) => boolean = () => true,
  ) => rows.filter((row) => row.project_id === projectId && predicate(row)).length;

  const tasks = tasksResult.data ?? [];
  const reviews = reviewsResult.data ?? [];
  const members = membersResult.data ?? [];
  const projects: TelegramProjectSummary[] = (projectsResult.data ?? [])
    .map((project) => {
      const chat = chatByProject.get(project.id);
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        healthScore: Number(project.health_score),
        healthLabel: project.health_label,
        timezone: project.timezone,
        chatTitle: chat?.title ?? null,
        chatType: chat?.chat_type ?? null,
        memberRole: membershipByProject.get(project.id)?.role ?? "member",
        memberCount: countFor(members, project.id),
        taskCount: countFor(tasks, project.id),
        completedTaskCount: countFor(
          tasks,
          project.id,
          (task) => task.status === "done",
        ),
        assignedTaskCount: countFor(
          tasks,
          project.id,
          (task) => task.owner_telegram_user_id === telegramUserRecordId,
        ),
        pendingReviewCount: countFor(reviews, project.id),
        updatedAt: project.updated_at,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    projects,
    totalTasks: tasks.length,
    assignedTasks: tasks.filter(
      (task) => task.owner_telegram_user_id === telegramUserRecordId,
    ).length,
    pendingReviews: reviews.length,
  };
}

export type TelegramProjectTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  dueLabel: string | null;
  ownerName: string | null;
};

export type TelegramProjectDetail = TelegramProjectSummary & {
  tasks: TelegramProjectTask[];
  members: Array<{ id: string; displayName: string; role: string }>;
};

export async function getTelegramProjectDetail(
  telegramUserRecordId: string,
  projectId: string,
): Promise<TelegramProjectDetail | null> {
  const admin = requireAdmin();
  const { data: membership, error: membershipError } = await admin
    .from("taskgoblin_project_members")
    .select("project_id, role")
    .eq("project_id", projectId)
    .eq("telegram_user_id", telegramUserRecordId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;

  const [projectResult, chatResult, membersResult, tasksResult, reviewsResult] =
    await Promise.all([
      admin
        .from("taskgoblin_projects")
        .select(
          "id, name, description, health_score, health_label, timezone, updated_at",
        )
        .eq("id", projectId)
        .single(),
      admin
        .from("taskgoblin_telegram_chats")
        .select("title, chat_type")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .maybeSingle(),
      admin
        .from("taskgoblin_project_members")
        .select("telegram_user_id, display_name, role")
        .eq("project_id", projectId)
        .order("display_name"),
      admin
        .from("taskgoblin_tasks")
        .select(
          "id, title, description, status, priority, due_at, due_label, owner_telegram_user_id",
        )
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false }),
      admin
        .from("taskgoblin_project_event_candidates")
        .select("id")
        .eq("project_id", projectId)
        .in("state", ["detected", "awaiting_confirmation"]),
    ]);

  const firstError = [
    projectResult,
    chatResult,
    membersResult,
    tasksResult,
    reviewsResult,
  ].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  if (!projectResult.data) return null;

  const members = (membersResult.data ?? []).map((member) => ({
    id: member.telegram_user_id,
    displayName: member.display_name,
    role: member.role,
  }));
  const memberNameById = new Map(
    members.map((member) => [member.id, member.displayName]),
  );
  const tasks: TelegramProjectTask[] = (tasksResult.data ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueAt: task.due_at,
    dueLabel: task.due_label,
    ownerName: task.owner_telegram_user_id
      ? memberNameById.get(task.owner_telegram_user_id) ?? null
      : null,
  }));
  const completedTaskCount = tasks.filter((task) => task.status === "done").length;
  const assignedTaskCount = (tasksResult.data ?? []).filter(
    (task) => task.owner_telegram_user_id === telegramUserRecordId,
  ).length;

  return {
    id: projectResult.data.id,
    name: projectResult.data.name,
    description: projectResult.data.description,
    healthScore: Number(projectResult.data.health_score),
    healthLabel: projectResult.data.health_label,
    timezone: projectResult.data.timezone,
    chatTitle: chatResult.data?.title ?? null,
    chatType: chatResult.data?.chat_type ?? null,
    memberRole: membership.role,
    memberCount: members.length,
    taskCount: tasks.length,
    completedTaskCount,
    assignedTaskCount,
    pendingReviewCount: reviewsResult.data?.length ?? 0,
    updatedAt: projectResult.data.updated_at,
    tasks,
    members,
  };
}
