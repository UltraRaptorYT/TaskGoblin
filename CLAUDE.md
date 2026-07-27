# TaskGoblin Repository Guide

## Product Identity

TaskGoblin turns Telegram project conversations into structured, accountable work.

TaskGoblin is a Telegram-native AI project manager. It lives inside a Telegram group, observes project conversations, detects possible tasks, owners, deadlines, decisions, blockers, and progress updates, and maintains a structured project state behind the chat.

Telegram is the primary interface.

A web interface may exist later as a secondary administration or visualisation surface, but the core MVP must work inside Telegram.

## Core Product Principle

TaskGoblin is not a generic chatbot and not a disposable conversation summariser.

It maintains a persistent project state derived from Telegram conversations.

The core loop is:

1. Observe a Telegram message.
2. Detect a possible project event.
3. Extract structured information.
4. Ask for confirmation when the information is uncertain or consequential.
5. Persist the confirmed event.
6. Allow users to query or modify project state through Telegram.
7. Send relevant reminders and updates.

Project events may include:

- task creation
- task assignment
- deadline creation or change
- task completion
- progress updates
- project decisions
- blockers
- questions
- risks
- milestones

## Current MVP Goal

Build a working Telegram-native prototype that demonstrates:

- adding TaskGoblin to a Telegram group
- receiving Telegram webhook updates
- identifying possible tasks from natural conversation
- preserving the source message
- asking users to confirm, edit, or ignore detected tasks
- persisting confirmed tasks and project state
- querying project state through Telegram commands
- updating and completing tasks
- sending private due-date reminders to task owners
- keeping a clear event history

The MVP should prove that TaskGoblin can translate unstructured team conversation into a reliable, queryable project state.

## Primary User Experience

The main user experience happens in Telegram.

Example:

User:

@alex can you create the project UI by Friday?

TaskGoblin:

Possible task detected:

Task: Create the project UI
Owner: @alex
Deadline: Friday

[Confirm] [Edit] [Ignore]

After confirmation:

Task #12 created.
Owner: @alex
Deadline: Friday.

Later:

User:

I finished the UI. Here is the screenshot.

TaskGoblin:

Is this an update for Task #12 — Create the project UI?

[Mark complete] [Add progress update] [Not related]

## Telegram Commands

Implement or preserve the following MVP commands:

- `/help`
  Show the available commands.

- `/summary`
  Show a concise summary of project progress, active work, blockers, recent decisions, and upcoming deadlines.

- `/project`
  Show project purpose, current phase, priorities, milestones, and overall state.

- `/tasks`
  Show active project tasks.

- `/mytasks`
  Show tasks owned by the requesting user, grouped by overdue, upcoming, blocked, and completed.

- `/addtask`
  Manually create a task.

  Example:
  `/addtask Prepare the demo | owner: @alex | deadline: Friday`

- `/done`
  Mark a task as completed.

  Example:
  `/done 12`

- `/update`
  Update task owner, status, deadline, or priority.

  Examples:
  `/update 12 status blocked`
  `/update 12 deadline Friday`
  `/update 12 owner @alex`

- `/recent`
  Show recent task, deadline, decision, blocker, and milestone changes.

- `/setproject`
  Set the project name, goal, or final deadline.

- `/addmilestone`
  Create a project milestone.

Optional after the core flow works:

- `/kpi`
- `/blockers`
- `/unassigned`

## Behaviour Rules

### Detection

Do not convert every suggestion into a task.

Distinguish between:

- ideas
- requests
- tentative suggestions
- explicit commitments
- explicit assignments
- progress updates
- completed work

Messages such as “let’s make a UI” should normally produce a low-confidence proposal or no task.

Messages such as “@alex, please create the UI by Friday” are stronger task candidates.

### Confirmation

Require confirmation before persisting consequential inferred changes when confidence is not sufficiently high.

Consequential changes include:

- assigning an owner
- setting or changing a deadline
- marking a task complete
- deleting a task
- creating a milestone
- recording an important project decision

Use Telegram inline buttons where appropriate:

- Confirm
- Edit
- Ignore
- Mark complete
- Add update
- Report blocker

### Accuracy

- Never invent owners.
- Never invent deadlines.
- Never fabricate project metrics.
- Preserve Telegram message IDs and source context.
- Represent uncertainty explicitly.
- Avoid creating duplicate tasks from repeated messages.
- Resolve relative dates using the message timestamp and project timezone.
- Ask for clarification where an owner, deadline, or referenced task is ambiguous.

### Task Completion

Do not automatically mark a task complete solely because a user says something that resembles completion.

Match the message against existing tasks and request confirmation.

Attachments may be stored as supporting evidence, but an attachment alone does not prove completion.

### Metrics

Metrics must be calculated only from stored confirmed data.

Examples:

- open task count
- completed task count
- overdue task count
- tasks without owners
- active blockers
- task completion rate

Do not claim a project is “70% complete” unless the calculation method is explicit.

### Reminders

Task reminders should normally be sent privately to the assigned user.

A reminder should include:

- project
- task
- deadline
- status
- actions such as Mark done, Update deadline, or Report blocker

Avoid publicly shaming users in group chats.

Group escalation should only happen when explicitly configured.

## MVP Boundaries

Do not build a full Jira clone.

Exclude unless needed for the demonstrated core flow:

- sprints
- epics
- story points
- custom workflows
- extensive analytics
- billing
- complex role management
- Google Calendar integration
- multiple chat platforms
- advanced workload balancing
- autonomous project planning

Do not make Telegram export upload the main product flow.

Legacy Telegram import functionality may remain temporarily for testing or migration, but it must not define the primary architecture or user experience.

## Architecture Direction

Use the existing stack where practical:

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase Auth and Postgres
- OpenAI Responses API with Structured Outputs
- Telegram Bot API
- Telegram webhooks
- scheduled worker or cron-compatible reminder processing

Before using Next.js APIs or conventions, inspect the installed Next.js documentation under:

`node_modules/next/dist/docs/`

Follow the version installed in the repository rather than relying on remembered framework behaviour.

## Suggested Domain Model

Maintain a persistent project state with entities such as:

- profiles
- telegram_users
- telegram_chats
- projects
- project_members
- project_events
- telegram_messages
- ai_detection_runs
- task_candidates
- tasks
- task_updates
- decisions
- questions
- blockers
- milestones
- reminders
- notification_deliveries

Important relationships:

- a Telegram chat may correspond to one active project
- Telegram users must be linked to project members
- every inferred item should reference its source Telegram message where possible
- task candidates should be separate from confirmed tasks
- project events should provide an auditable timeline

## Recommended State Transitions

Task candidate:

`detected -> awaiting_confirmation -> confirmed | edited | ignored`

Task:

`backlog -> todo -> doing -> blocked -> done`

Reminder:

`scheduled -> delivered | failed | cancelled`

## Security And Privacy

- Validate Telegram webhook secrets.
- Do not trust Telegram payload fields without validation.
- Restrict project data to the corresponding Telegram chat and authorised users.
- Use row-level security for application data.
- Avoid storing more message content than required.
- Provide a clear strategy for retention and deletion.
- Do not expose service-role credentials to client-side code.
- Log AI decisions without storing secrets.
- Treat private reminder delivery and Telegram account linking carefully.

## AI Pipeline

Use a structured pipeline rather than a single unrestricted chatbot response.

Suggested stages:

1. Normalise Telegram update.
2. Classify whether the message contains a project event.
3. Extract a typed candidate event.
4. Match against existing project state.
5. Detect duplicates or conflicts.
6. Calculate confidence.
7. Decide whether confirmation is required.
8. Persist the candidate or confirmed event.
9. Generate the Telegram response.

Use Structured Outputs for machine-consumed model responses.

Keep natural-language generation separate from state mutation.

The model must never directly write arbitrary database mutations.

## Web Interface

The website is secondary.

Use it only where it provides clear value, such as:

- bot setup
- Telegram account linking
- project configuration
- privacy and retention settings
- audit history
- debugging
- optional board visualisation

Do not require users to use the website for normal task creation, summaries, updates, or completion.

## Legacy Code

The repository contains an older upload-first implementation.

Before deleting or rewriting code:

1. identify which modules are reusable
2. identify which modules are legacy-only
3. identify database migrations that require replacement or migration
4. preserve useful extraction, task, reminder, and source-trace logic
5. avoid destructive schema changes without documenting the migration path

Likely reusable concepts:

- structured OpenAI extraction
- tasks
- source traces
- reminders
- project events
- Supabase integration
- Telegram webhook scaffold

Likely legacy concepts:

- Telegram Desktop export as the primary onboarding flow
- upload-first application navigation
- web board as the primary workspace
- scan-run flow that assumes a complete historical transcript

## Testing And Verification

Run after implementation changes:

```bash
npm run lint
npm run build
npm test
