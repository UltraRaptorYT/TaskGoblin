import type {
  NormalizedTelegramImport,
  TaskItem,
  TaskScanResult,
} from "@/lib/taskgoblin-types";

export function createMockScanResult(
  telegramImport: NormalizedTelegramImport
): TaskScanResult {
  if (telegramImport.chatType.startsWith("project_brief_")) {
    return createMockBriefScanResult(telegramImport);
  }

  const textMessages = telegramImport.messages.filter((message) =>
    message.text.trim()
  );
  const source = textMessages.slice(-8);
  const participants = telegramImport.participants.map((person) => person.name);
  const firstOwner = participants[0] ?? "Project lead";
  const secondOwner = participants[1] ?? null;

  const tasks: TaskItem[] = [
    {
      id: "task-pitch-deck",
      title: "Prepare pitch deck",
      description: "Turn the launchpad discussion into a concise demo deck.",
      owner: firstOwner,
      deadline: "Friday 6 PM",
      status: "doing",
      priority: "high",
      confidence: 0.86,
      sourceMessageIds: ids(source.slice(0, 2)),
      sourceSnippet: source[0]?.text,
    },
    {
      id: "task-landing-page",
      title: "Polish landing page and demo flow",
      description: "Make the first screen explain the Telegram-to-board workflow.",
      owner: secondOwner,
      deadline: "Before demo day",
      status: "todo",
      priority: "medium",
      confidence: 0.78,
      sourceMessageIds: ids(source.slice(2, 4)),
      sourceSnippet: source[2]?.text,
    },
    {
      id: "task-deployment",
      title: "Deploy the app",
      description: "Production deployment was mentioned but no owner was explicit.",
      owner: null,
      deadline: null,
      status: "backlog",
      priority: "urgent",
      confidence: 0.7,
      sourceMessageIds: ids(source.slice(4, 5)),
      sourceSnippet: source[4]?.text,
    },
    {
      id: "task-branding",
      title: "Confirm visual branding",
      description: "Agree on the product tone and Goblin personality.",
      owner: participants[2] ?? null,
      deadline: "Tomorrow",
      status: "blocked",
      priority: "medium",
      confidence: 0.74,
      blockedBy: "Waiting on team approval",
      sourceMessageIds: ids(source.slice(5, 7)),
      sourceSnippet: source[5]?.text,
    },
  ];

  return {
    summary: `${telegramImport.chatName} has ${textMessages.length} text messages from ${telegramImport.participants.length} detected participants. TaskGoblin found delivery work, one ghost task, and a blocker that should be handled before demo prep continues.`,
    projectHealth: {
      score: 68,
      label: "At risk",
      explanation:
        "The project has active work, but deployment has no owner and one task is blocked.",
    },
    tasks,
    decisions: [
      {
        id: "decision-telegram-first",
        text: "Use Telegram export as the first import path.",
        source: telegramImport.chatName,
        sourceMessageIds: ids(source.slice(0, 1)),
      },
      {
        id: "decision-light-jira",
        text: "Use a light Jira-style board instead of a full Jira clone.",
        source: telegramImport.chatName,
        sourceMessageIds: ids(source.slice(1, 2)),
      },
    ],
    questions: [
      {
        id: "question-deploy-owner",
        text: "Who owns production deployment?",
        sourceMessageIds: ids(source.slice(4, 5)),
      },
      {
        id: "question-reminders",
        text: "Should reminders go to Telegram only, or also calendar?",
        owner: firstOwner,
        sourceMessageIds: ids(source.slice(6, 7)),
      },
    ],
    risks: [
      {
        id: "risk-ghost-deployment",
        type: "ghost_task",
        severity: "high",
        message: "Deployment has no confirmed owner.",
        reason: "A delivery task was detected without a matching commitment.",
        sourceMessageIds: ids(source.slice(4, 5)),
      },
      {
        id: "risk-branding-blocker",
        type: "blocker",
        severity: "medium",
        message: "Branding confirmation is blocking final demo polish.",
        reason: "The landing page depends on final tone and visual direction.",
        sourceMessageIds: ids(source.slice(5, 7)),
      },
      {
        id: "risk-missing-deadline",
        type: "missing_deadline",
        severity: "medium",
        message: "Deployment has no clear deadline.",
        sourceMessageIds: ids(source.slice(4, 5)),
      },
    ],
    blockers: [
      {
        id: "blocker-branding",
        taskId: "task-branding",
        message: "Visual branding needs approval before final landing page polish.",
        blockedBy: "Team approval",
        sourceMessageIds: ids(source.slice(5, 7)),
      },
    ],
    accountabilitySuggestions: {
      professional:
        "Hi team, quick check-in: deployment still needs an owner and deadline. Can someone confirm who will take it and when it will be done?",
      friendly:
        "Hey team, small nudge: deployment is still floating around without an owner. Who can grab it before demo prep gets spicy?",
      goblin:
        "The deployment task is wandering around ownerless. Please adopt it before the deadline adopts us.",
    },
  };
}

function createMockBriefScanResult(
  brief: NormalizedTelegramImport
): TaskScanResult {
  const sections = brief.messages.filter((message) => message.text.trim());
  const first = sections[0];
  const second = sections[1];
  const third = sections[2];
  const tasks: TaskItem[] = [first, second, third]
    .filter((section): section is NonNullable<typeof section> => Boolean(section))
    .map((section, index) => ({
      id: `brief-task-${index + 1}`,
      title: section.text.split(/[.!?\n]/)[0].slice(0, 72) || `Brief item ${index + 1}`,
      description: section.text.slice(0, 240),
      owner: null,
      deadline: null,
      status: "backlog",
      priority: index === 0 ? "high" : "medium",
      confidence: 0.62,
      sourceMessageIds: [section.id],
      sourceSnippet: section.text.slice(0, 180),
    }));

  return {
    summary: `${brief.chatName} contains ${sections.length} readable sections. Connect Gemini for full semantic extraction; this preview has converted the opening sections into reviewable tasks.`,
    projectHealth: {
      score: 55,
      label: "Needs review",
      explanation: "The brief was imported, but owners and deadlines need confirmation.",
    },
    tasks,
    decisions: [],
    questions: [{
      id: "brief-question-ownership",
      text: "Who owns each deliverable in this brief?",
      sourceMessageIds: ids(sections.slice(0, 1)),
    }],
    risks: [{
      id: "brief-risk-ownership",
      type: "ghost_task",
      severity: "medium",
      message: "The imported deliverables do not have confirmed owners.",
      reason: "Mock mode does not infer ownership from project briefs.",
      sourceMessageIds: ids(sections.slice(0, 1)),
    }],
    blockers: [],
    accountabilitySuggestions: {
      professional: "Please review the imported deliverables and confirm an owner and deadline for each item.",
      friendly: "The brief is mapped—who wants to claim each quest and add a deadline?",
      goblin: "Fresh quests have entered the den. Please assign their keepers before they wander off.",
    },
  };
}

function ids(messages: { id: number }[]) {
  return messages.map((message) => message.id);
}
