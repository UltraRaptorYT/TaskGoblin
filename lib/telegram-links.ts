export function telegramProjectDashboardUrl(projectId: string) {
  const configured = process.env.TASKGOBLIN_APP_URL?.trim().replace(/\/$/, "");
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.pathname = `/dashboard/projects/${encodeURIComponent(projectId)}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
