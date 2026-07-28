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
OPENAI_SCAN_MODEL=gpt-5.6-terra
OPENAI_REMINDER_MODEL=gpt-5.6-luna
TELEGRAM_EVENT_DETECTION_MODE=openai
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
- project-event Confirm, Edit and Ignore callbacks
- inline task-selection callbacks

The welcome asks each team member to say `hello` in the group so TaskGoblin can
link their Telegram identity to the project. Members must also open the bot
privately and press Start once before Telegram will allow private reminders.
In a private bot chat, `/mytasks` groups the requesting user's confirmed tasks
across every TaskGoblin project.

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

OpenAI is also the single provider for legacy import scans and generated
reminders. The defaults are role-specific: Sol for high-signal Telegram event
detection, Terra for document/chat extraction, and Luna for short reminder
copy. Override them independently with `OPENAI_EVENT_MODEL`,
`OPENAI_SCAN_MODEL`, and `OPENAI_REMINDER_MODEL`. Import scanning falls back to
the mock scanner without a key; reminders fall back to deterministic templates.

The model can propose task creation, assignment, progress, completion,
deadline, blocker and decision events. Application code validates owner
usernames against known members, task references against current tasks and
deadline text against the source message. Every accepted event is persisted as
a candidate before Telegram controls are sent; only a callback can apply it.

To observe ordinary group messages, configure the bot's Telegram privacy mode
appropriately and disclose the bot's message processing to group members.
