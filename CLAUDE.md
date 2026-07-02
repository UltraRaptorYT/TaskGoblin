# TaskGoblin Agent Brief

## Project Identity

TaskGoblin turns Telegram chaos into finished projects.

TaskGoblin is a Telegram-first AI accountability workspace. Users import Telegram Desktop exports, OpenAI extracts project intelligence, the team reviews work on a light Jira-style board, and the Goblin helps keep people accountable through task health, source traces, and Telegram reminder nudges.

## Product Goal

The product goal is to turn messy group chats into an accountable project system: tasks, owners, deadlines, decisions, questions, blockers, risks, project history, and reminders.

Pitch lines:

- Jira for group chats.
- Turns Telegram chaos into tasks, owners, deadlines, and reminders.
- Your group project accountability goblin.

## MVP Scope

Build the first real MVP around Telegram Desktop import:

- Upload Telegram `result.json` or export `.zip`.
- Parse chat metadata, participants, service messages, normal messages, and string or rich-array text.
- Scan the normalized transcript with OpenAI Structured Outputs.
- Persist projects, imports, messages, scan runs, tasks, risks, questions, decisions, blockers, comments, history, reminders, and delivery records in Supabase.
- Show a light Jira board with Backlog, To Do, Doing, Blocked, Done, and Overdue.
- Let users assign owners, update due labels/status/priority, inspect source snippets, and stage Telegram reminders.
- Keep demo-mode fallbacks working when OpenAI or Supabase env vars are missing.

V1 limits:

- No full Jira clone: no sprints, epics, story points, custom workflows, or reporting.
- Telegram historical ingestion is export-based; a bot can only handle future updates after it is connected.
- Google Calendar is a later integration; optional `.ics` export is acceptable if cheap.

## User Experience

The first screen should be the usable product, not a landing page.

Core flow:

1. User signs in.
2. User uploads Telegram Desktop `result.json` or export ZIP.
3. TaskGoblin normalizes the export and runs a scan.
4. User reviews the board, risks, decisions, questions, and blockers.
5. User confirms or edits tasks.
6. User assigns owners and schedules Telegram reminders.
7. Project history records import, scan, assignment, reminder, and board events.

The Goblin appears as:

- Scanner: extracts structured work from chat.
- Board copilot: flags ghost tasks, blockers, missing deadlines, stale work, and project health.
- Reminder agent: writes nudges in Professional, Friendly, or Goblin Mode.

## Data Model

Shared app types live in `lib/taskgoblin-types.ts`.

Important public shapes:

- `NormalizedTelegramImport`: normalized chat id, name, type, participants, and messages.
- `TaskScanResult`: summary, project health, tasks, decisions, questions, risks, blockers, and accountability suggestions.
- `TaskItem`: id, title, optional description, owner, deadline, status, priority, confidence, source message ids, and optional source snippet.

Supabase schema lives in `supabase/migrations/0001_taskgoblin_full_mvp.sql`.

Primary tables:

- `profiles`, `workspaces`, `workspace_members`
- `projects`, `project_members`, `project_events`
- `telegram_imports`, `telegram_messages`, `chat_participants`
- `scan_runs`
- `tasks`, `task_comments`
- `decisions`, `questions`, `risks`, `blockers`
- `reminders`, `notification_deliveries`

All app tables should have RLS enabled. Members can read their project data; project admins manage project membership and destructive/admin actions; service-role server routes handle imports, AI scan writes, and Telegram webhook writes.

## Architecture Notes

Use the existing stack:

- Next.js 16 App Router.
- React 19.
- Tailwind CSS 4.
- shadcn-style UI components.
- lucide-react icons.
- Supabase Auth and Postgres.
- OpenAI Responses API with Structured Outputs.
- Telegram Bot API for reminder delivery and future bot updates.

Important framework rule:

- This is not assumed to be the Next.js version from model memory. Before coding against Next.js APIs, routing conventions, caching, server components, route handlers, metadata, auth boundaries, or file structure, read the relevant guide in `node_modules/next/dist/docs/` and follow that version's guidance.

Current implementation map:

- `app/page.tsx` renders the main workspace.
- `app/taskgoblin-app.tsx` is the interactive upload, board, task detail, and reminder UI.
- `app/api/imports/telegram/route.ts` accepts Telegram JSON/ZIP uploads.
- `app/api/imports/[id]/scan/route.ts` is the scan endpoint scaffold.
- `app/api/tasks/[id]/route.ts` updates task fields.
- `app/api/tasks/[id]/reminders/route.ts` schedules reminder records.
- `app/api/messages/accountability/route.ts` generates reminder copy.
- `app/api/telegram/webhook/route.ts` receives Telegram bot webhook payloads.
- `lib/telegram-parser.ts` normalizes Telegram exports.
- `lib/openai-scan.ts` contains the OpenAI scan pipeline.
- `lib/mock-scan.ts` keeps demo mode usable without provider keys.

Environment variables are documented in `.env.example`.

## AI Behavior Rules

For both mock and OpenAI-backed scans:

- Extract only supported fields.
- Preserve source message ids whenever possible.
- Mark uncertainty with lower confidence rather than inventing facts.
- Do not invent task owners or deadlines.
- Surface ghost tasks when no owner is clear.
- Surface blockers when one task depends on unfinished or missing work.
- Surface missing deadlines and vague promises as risks.
- Keep accountability messages useful and safe for real teammates.
- Goblin Mode may be funny, but it should not be cruel, discriminatory, or abusive.

## Design Direction

TaskGoblin should look like a working project dashboard.

Guidelines:

- Prioritize Telegram import, board review, assignment, risk inspection, and reminders.
- Use compact dashboards and readable board cards.
- Show source snippets so users trust the AI output.
- Use lucide-react icons in buttons and controls.
- Keep playful branding secondary to workflow clarity.
- Avoid oversized hero sections, generic SaaS copy, and decorative card-heavy pages.
- Ensure mobile and desktop layouts remain readable.

## Testing And Verification

Run after implementation changes:

```bash
npm run lint
npm run build
```

Manual checks:

- Upload Telegram `result.json`.
- Upload Telegram ZIP containing `result.json`.
- Confirm string text and rich text arrays become plain transcript text.
- Confirm service messages do not break import.
- Confirm scan output renders board lanes, risks, questions, decisions, and blockers.
- Confirm owner, status, and due label edits update the UI.
- Confirm reminder tone changes the generated message.
- Confirm app remains usable without OpenAI/Supabase env vars.

Provider checks when configured:

- Supabase migration applies cleanly.
- RLS blocks non-members from project data.
- OpenAI scan returns schema-valid JSON.
- Telegram webhook records delivery payloads.
