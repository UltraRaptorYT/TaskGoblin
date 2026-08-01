# TaskGoblin

TaskGoblin is a Telegram-native AI project manager. The live Telegram pipeline
receives group updates, persists chats, users, members and messages, detects one
supported project event per message, and asks for confirmation through inline
buttons before changing project state.

The older Telegram-export and project-brief import flow remains available in
the web application.

## Local development

```bash
npm install
npm run dev
```

Verification commands:

```bash
npm run lint
npm test
npm run test:evaluate
npm run build
```

## Environment

Copy `.env.example` to `.env.local` and configure at least:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_EVENT_MODEL=gpt-5.6-sol
OPENAI_AGENT_MODEL=gpt-5.6-sol
OPENAI_SCAN_MODEL=gpt-5.6-terra
OPENAI_REMINDER_MODEL=gpt-5.6-luna
TELEGRAM_EVENT_DETECTION_MODE=openai
TELEGRAM_PROJECT_AGENT_MODE=openai
TELEGRAM_MESSAGE_DEBOUNCE_MS=2500
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_BOT_USERNAME=
```

`TELEGRAM_WEBHOOK_SECRET` is mandatory for the webhook. Requests fail closed
when it is absent.

## Database

Apply the checked-in Supabase migrations before registering the webhook:

```bash
npx supabase db push
```

Phase 1 adds:

- Telegram chats and users
- Telegram project membership
- idempotent webhook update receipts
- live-message fields on the existing Telegram message table
- task candidates and their confirmation state
- Telegram ownership/source references on confirmed tasks

The per-message AI migration additionally adds project timezone, auditable AI
detection runs, generic project-event candidates, duplicate/task-match
references, and an atomic human-review transition.

The Telegram document-context migration stores private metadata and extracted
text for supported files shared in project groups. Binary files are downloaded
from Telegram only for parsing and are not retained by TaskGoblin.

The inline-interaction migration adds short-lived, service-role-only edit
sessions. These sessions let a member change one task or candidate field from
Telegram without treating the next free-text reply as a new project event.

A new group is provisioned with a workspace and project when its first update
is processed. This is an MVP default and can later be replaced by an explicit
admin linking flow.

## Telegram webhook

Register the deployed route with Telegram and use the same secret configured in
the application:

```text
https://YOUR_DEPLOYMENT/api/telegram/webhook
```

Configure Telegram to send the secret in
`X-Telegram-Bot-Api-Secret-Token`. The bot currently handles:

- a group welcome when TaskGoblin is added
- `hello` member identity acknowledgement
- `/start`
- `/help`
- `/summary`
- `/project`
- `/kpi`
- `/tasks`
- `/mytasks`
- `/undo`
- project-event Confirm, Edit and Ignore callbacks
- a project home menu for open tasks, work due today, calendar, and settings
- task cards with Complete/Reopen, title, owner, and deadline controls
- actionable reminder cards with Done, Snooze, and Change deadline controls
- guided candidate title, owner, and deadline editing
- project-group PDF, DOCX, TXT and MD context ingestion

After deployment, configure both the command menus and webhook update types:

```bash
npm run bot:configure
```

The local environment used for this command must include
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and
`TASKGOBLIN_APP_URL`. The webhook subscribes to `my_chat_member` so a newly
added bot can greet and initialise a group immediately.

The welcome asks each team member to say `hello` in the group so TaskGoblin can
link their Telegram identity to the project. Members must also open the bot
privately and press Start once before Telegram will allow private reminders.
In a private bot chat, `/mytasks` groups the requesting user's confirmed tasks
across every TaskGoblin project.

`/undo` reverses the latest task mutation in the current project group. Task
changes are recorded in transaction-sized groups, so one bulk assignment is
undone as one action. A confidently matched explicit completion is applied
without an extra confirmation message: TaskGoblin reacts with 🎉, marks the
task done, and attributes it to the member who completed it.

The project-report cron route is a five-minute dispatcher. Project administrators
can configure each project's automatic report as daily or weekly, select the
local send time and timezone, choose a weekly weekday, or pause it from the web
dashboard. Reports include progress, urgent and overdue work, ownership,
blockers, and a seven-day outlook. Delivery claims prevent duplicates and retry
a failed Telegram send up to three times. Apply
`supabase/migrations/20260801143540_configurable_project_reports.sql`, then run
`supabase/cron-reminders.example.sql` (or update the existing Supabase Cron job)
after deployment. The existing due-reminder cron remains frequent so deadline
reminders are not delayed until a scheduled report.

Inline title and owner editing uses a 10-minute edit session. Apply
`supabase/migrations/20260801064358_telegram_inline_edit_sessions.sql` before
deploying these controls. The table has RLS enabled and is granted only to the
server-side `service_role`; browser clients cannot access edit sessions.

Rapid non-command group messages from the same member are coalesced for
`TELEGRAM_MESSAGE_DEBOUNCE_MS` (2.5 seconds by default, capped at 5 seconds).
Only the newest message in the burst invokes OpenAI, so multi-bubble thoughts
are handled as one request. Commands, onboarding, private messages and
documents bypass this delay.

Private replies to a delivered TaskGoblin reminder are linked back to the
reminder's exact task and project. The project agent can then give grounded
advice using current tasks and stored project documents, and returns the
project dashboard link. Apply
`supabase/migrations/20260728144617_telegram_private_reply_context.sql` before
deploying this behavior.

Documents sent in a linked project group are limited to 15 MB. TaskGoblin
stores their extracted text as project context and acknowledges success or
failure in Telegram. Scanned PDFs require OCR before they can be read.

After deploying command changes, configure Telegram's private and group command
menus:

```bash
npm run bot:configure
```

Set `TELEGRAM_EVENT_DETECTION_MODE=openai` and provide `OPENAI_API_KEY` for
OpenAI Structured Outputs. Set the mode to `mock`, or omit the key without
forcing OpenAI mode, for the deterministic development detector. The mock
detector uses no provider calls and is evaluated against the held-out fixture
set with `npm run test:evaluate`. With a provider key configured, run
`npm run test:evaluate:openai` to measure the real Structured Outputs path.

Set `TELEGRAM_PROJECT_AGENT_MODE=openai` to answer project questions through a
bounded OpenAI tool call. In groups, the agent responds when TaskGoblin is
mentioned or replied to, and to clear project-planning requests such as "what
else needs to be done?" It receives confirmed tasks, members, recent chat, and
extracted project documents in one compact request, avoiding the previous
mandatory second model round.

When a planning request contains several uncovered deliverables, TaskGoblin
persists each one as a separate task candidate and shows **Create all** and
**Ignore all** controls. A confirmed batch creates every listed task. Likely
duplicates are left out, usernames are resolved only against known group
members, and deadline text must come from the current Telegram message.

For generic project names such as `DEMO`, the agent can also suggest a more
specific name when that name appears in the stored project context. The
suggestion is persisted and requires a Telegram confirmation before the
website is updated. Agent responses and group onboarding include a project
dashboard link when `TASKGOBLIN_APP_URL` is configured.

Apply
`supabase/migrations/20260728132307_telegram_agent_task_batches.sql` before
deploying this code. It removes the one-candidate-per-message restriction, adds
transactional batch review, and adds reviewable project-name candidates. If the
agent mode is omitted, it inherits `TELEGRAM_EVENT_DETECTION_MODE`.

OpenAI is also the single provider for legacy import scans and generated
reminders. The defaults are role-specific: Sol for high-signal Telegram event
detection and project-agent reasoning, Terra for document/chat extraction, and
Luna for short reminder copy. Override them independently with
`OPENAI_EVENT_MODEL`, `OPENAI_AGENT_MODEL`, `OPENAI_SCAN_MODEL`, and
`OPENAI_REMINDER_MODEL`. Import scanning falls back to the mock scanner without
a key; reminders fall back to deterministic templates.

The model can propose task creation, assignment, progress, completion,
deadline, blocker and decision events. Application code validates owner
usernames against known members, task references against current tasks and
deadline text against the source message. Every accepted event is persisted as
a candidate before Telegram controls are sent; only a callback can apply it.

To observe ordinary group messages, configure the bot's Telegram privacy mode
appropriately and disclose the bot's message processing to group members.
