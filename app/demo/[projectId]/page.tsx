import TaskGoblinApp from "@/app/taskgoblin-app";

export default async function DemoProjectPage({ params }: PageProps<"/demo/[projectId]">) {
  const { projectId } = await params;
  return <TaskGoblinApp initialDemoMode demoProjectId={projectId} />;
}
