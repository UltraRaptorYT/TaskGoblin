export type ProjectHealthTask = {
  status: string;
  dueAt?: string | null;
  ownerTelegramUserId?: string | null;
};

export type ProjectHealth = {
  score: number;
  label: "Getting started" | "On track" | "Needs attention" | "At risk" | "Complete";
  reason: string;
};

const completedStatuses = new Set(["done"]);

export function calculateProjectHealth(
  tasks: ProjectHealthTask[],
  now = new Date(),
): ProjectHealth {
  if (tasks.length === 0) {
    return {
      score: 0,
      label: "Getting started",
      reason: "Add the first confirmed task to begin tracking project health.",
    };
  }

  const activeTasks = tasks.filter(
    (task) => !completedStatuses.has(task.status),
  );
  if (activeTasks.length === 0) {
    return {
      score: 100,
      label: "Complete",
      reason: `All ${tasks.length} confirmed ${pluralize("task", tasks.length)} are done.`,
    };
  }

  const overdueCount = activeTasks.filter(
    (task) =>
      task.status === "overdue" ||
      (task.dueAt !== null &&
        task.dueAt !== undefined &&
        new Date(task.dueAt).getTime() < now.getTime()),
  ).length;
  const blockedCount = activeTasks.filter(
    (task) => task.status === "blocked",
  ).length;
  const unassignedCount = activeTasks.filter(
    (task) => !task.ownerTelegramUserId,
  ).length;
  const score = Math.max(
    0,
    100 -
      Math.min(50, overdueCount * 20) -
      Math.min(30, blockedCount * 15) -
      Math.min(20, unassignedCount * 5),
  );

  if (overdueCount > 0 || blockedCount > 1) {
    return {
      score,
      label: "At risk",
      reason: joinSignals(overdueCount, blockedCount, unassignedCount),
    };
  }

  if (blockedCount > 0 || unassignedCount > 0) {
    return {
      score,
      label: "Needs attention",
      reason: joinSignals(overdueCount, blockedCount, unassignedCount),
    };
  }

  return {
    score,
    label: "On track",
    reason: `${activeTasks.length} active ${pluralize("task", activeTasks.length)}, with no blockers or overdue work.`,
  };
}

function joinSignals(
  overdueCount: number,
  blockedCount: number,
  unassignedCount: number,
) {
  const signals = [
    overdueCount > 0
      ? `${overdueCount} overdue ${pluralize("task", overdueCount)}`
      : null,
    blockedCount > 0
      ? `${blockedCount} blocked ${pluralize("task", blockedCount)}`
      : null,
    unassignedCount > 0
      ? `${unassignedCount} unassigned ${pluralize("task", unassignedCount)}`
      : null,
  ].filter((signal): signal is string => Boolean(signal));

  return signals.join(" · ");
}

function pluralize(noun: string, count: number) {
  return count === 1 ? noun : `${noun}s`;
}
