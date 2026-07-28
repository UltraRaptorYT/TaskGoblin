import type { Metadata } from "next";

import TaskGoblinApp from "@/app/taskgoblin-app";

export const metadata: Metadata = {
  title: "Legacy import workspace",
  description: "TaskGoblin's original brief and Telegram export importer.",
};

export default function LegacyWorkspacePage() {
  return <TaskGoblinApp />;
}
