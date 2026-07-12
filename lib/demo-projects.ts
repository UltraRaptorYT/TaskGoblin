export const DEMO_PROJECTS_KEY = "taskgoblin.demo.projects.v1";
export const LEGACY_DEMO_SCAN_KEY = "taskgoblin.demo.scan.v1";

export type DemoProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
};

export function demoProjectScanKey(projectId: string) {
  return `taskgoblin.demo.project.${projectId}.scan.v1`;
}

export function demoProjectMembersKey(projectId: string) {
  return `taskgoblin.demo.project.${projectId}.members.v1`;
}

export function readDemoProjects(): DemoProjectSummary[] {
  try {
    const value = window.localStorage.getItem(DEMO_PROJECTS_KEY);
    const projects = value ? (JSON.parse(value) as DemoProjectSummary[]) : [];
    return Array.isArray(projects) ? projects : [];
  } catch {
    return [];
  }
}

export function writeDemoProjects(projects: DemoProjectSummary[]) {
  window.localStorage.setItem(DEMO_PROJECTS_KEY, JSON.stringify(projects));
}
