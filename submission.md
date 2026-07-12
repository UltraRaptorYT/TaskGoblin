# TaskGoblin Project Submission

> Replace every `[TO COMPLETE]` field before submitting. Personal contact information and official public URLs could not be determined from the repository.

## Project Introduction*

TaskGoblin is a Telegram-first AI accountability workspace that turns messy team conversations and project documents into structured, actionable work. It is designed for student teams, startup crews, agencies, community organizers, and other groups that coordinate through chat but do not consistently maintain a formal project-management system.

Users upload a Telegram Desktop `result.json` export, a Telegram export ZIP, or a project brief in PDF, DOCX, Markdown, or plain-text format. TaskGoblin normalizes the source material and uses AI to identify tasks, owners, deadlines, decisions, questions, blockers, and delivery risks. The results appear on a lightweight Jira-style board where users can review source context, assign owners, change task status, add due-date labels, assess project health, and prepare accountability reminders.

The current product surface includes:

- Google authentication through Supabase, with a keyless demo mode.
- Telegram export and project-brief ingestion.
- AI-powered structured project scans with confidence and source traceability.
- Backlog, To Do, Doing, Blocked, Overdue, and Done board lanes.
- Task owner, status, and deadline editing.
- Project-health, risk, blocker, question, and decision extraction.
- Professional, Friendly, and playful Goblin reminder tones.
- Reminder staging and a Telegram webhook foundation.
- Supabase persistence for projects, source messages, scans, tasks, risks, reminders, and delivery records.

In short, TaskGoblin is “Jira for group chats”: it converts unstructured coordination into visible ownership and follow-through without requiring every teammate to become a project-management expert.

## Project Logo URL (Optional)

`[TO COMPLETE: Upload public/brand/taskgoblin-logo.png to a publicly accessible URL and insert the HTTPS URL here.]`

## Official Twitter / X (Optional)

`[TO COMPLETE: https://x.com/taskgoblin or @taskgoblin, if registered]`

## Official Discord (Optional)

`[TO COMPLETE: https://discord.gg/..., if available]`

## Official Telegram (Optional)

`[TO COMPLETE: https://t.me/... or @taskgoblin, if registered]`

## Primary Contact Person, Email, Position*

`[TO COMPLETE: Full name, email address, position and responsibility in TaskGoblin]`

Example: `Jane Tan, jane@example.com, Co-founder and Product Lead of TaskGoblin`

## Secondary Contact Person, Email, Position (Optional)

`[TO COMPLETE: Full name, email address, position and responsibility in TaskGoblin]`

## Core Team Members' Background*

`[TO COMPLETE WITH THE TEAM'S REAL DETAILS]`

Suggested format:

- **[Name] — [Role]:** [Relevant education, employment, technical or industry experience]. Responsible for [product, engineering, AI, business development, design, or operations].
- **[Name] — [Role]:** [Relevant education, employment, technical or industry experience]. Responsible for [specific TaskGoblin responsibilities].
- **[Name] — [Role]:** [Relevant education, employment, technical or industry experience]. Responsible for [specific TaskGoblin responsibilities].

As a team, we combine experience in `[software engineering / AI / product design / community operations / project management—edit as applicable]`. We are building TaskGoblin from direct familiarity with teams that coordinate important work in fast-moving group chats but struggle to translate conversations into clear ownership and delivery.

## Project Innovation (Related to AI)*

TaskGoblin treats AI as an operational accountability layer rather than a general-purpose chat interface. Its core innovation is converting long, noisy, chronological conversations into a traceable project state that people can review and act on.

The AI pipeline normalizes Telegram and document content before using structured model outputs to produce a consistent project schema. It extracts tasks, owners, deadlines, decisions, unresolved questions, blockers, risks, confidence scores, project health, and reminder suggestions. The model is explicitly instructed not to invent unsupported owners or dates; uncertain information is represented with lower confidence or null values. Extracted work retains source message IDs and snippets wherever possible, allowing users to inspect the evidence behind an AI-generated task.

TaskGoblin also identifies accountability gaps that conventional summarizers overlook. It flags “ghost tasks” without owners, vague commitments, missing deadlines, blocked dependencies, stale work, and delivery risks. Its reminder agent then creates context-aware follow-ups in Professional, Friendly, or Goblin Mode. This makes the product AI-native across the full workflow: understanding the conversation, structuring the project, identifying execution risk, and prompting the next human action.

The longer-term opportunity is a continuously updated project memory that listens to future Telegram activity—with user consent—and reconciles new messages against existing tasks, decisions, and commitments rather than repeatedly generating disconnected summaries.

## Pain Point Solved*

Many small teams already run their projects through Telegram and other group chats. Decisions are mixed with casual conversation, responsibilities are implied rather than assigned, deadlines are buried, and important requests quickly scroll out of view. Formal project-management tools can solve part of the problem, but they impose a second workflow: someone must manually copy information from chat, create tickets, keep statuses current, and chase teammates for updates.

This creates a costly execution gap for student groups, early-stage startups, agencies, volunteer organizations, and distributed teams. The pain becomes most visible near a deadline, when teams discover that a task had no owner, two people interpreted a decision differently, or a dependency was blocked for days without escalation. The cost includes missed deadlines, duplicated work, interpersonal friction, lower client or stakeholder trust, and time spent reconstructing what the team agreed to do.

TaskGoblin closes this gap by meeting teams where their work already happens. A user can import the existing conversation or brief and receive a reviewable project board in one scan. Instead of replacing chat, TaskGoblin adds structure, traceability, and accountability around it. Teams gain a shared view of who owns what, what is late or blocked, why a task exists, and who needs a timely nudge.

## Current Development Progress*

TaskGoblin currently has a functional MVP implemented as a responsive Next.js 16 application. The completed foundation includes:

- Telegram Desktop JSON and ZIP parsing, including rich-text arrays and service messages.
- PDF, DOCX, Markdown, and plain-text project-brief ingestion.
- OpenAI-powered structured extraction with a mock fallback for demonstrations.
- A project summary and health assessment.
- A six-lane task board with task selection and editing.
- Extraction and display models for decisions, questions, risks, and blockers.
- Source snippets, confidence values, and message traceability.
- Supabase authentication, PostgreSQL persistence, and row-level-security-oriented schema design.
- Accountability-message generation across three tones.
- Reminder scheduling records and a Telegram webhook endpoint scaffold.
- A demo mode that remains usable without external provider credentials.

The next milestones are:

1. Complete live Telegram Bot API delivery, webhook-secret verification, chat-ID capture, and user-to-Telegram-account linking.
2. Add an automated reminder worker that sends scheduled notifications and records delivery outcomes.
3. Complete end-to-end multi-user workspace and project-member flows.
4. Strengthen automated tests for imports, schema-valid AI output, authorization, task mutations, and reminder delivery.
5. Run pilots with real project teams and measure extraction accuracy, task-confirmation rates, reminder response rates, and on-time completion.
6. Add continuous ingestion for new bot-visible Telegram messages, followed by optional calendar and additional chat integrations.
7. Introduce production monitoring, usage limits, billing, onboarding, and administrative controls.

The current MVP demonstrates the complete core loop from unstructured project source to structured board and staged accountability action. Live Telegram delivery, production hardening, and user validation are the principal near-term steps before a broader launch.

## Expected Revenue Sources*

TaskGoblin is expected to use a freemium SaaS model with pricing aligned to team size, AI usage, project volume, and automation needs.

- **Free plan:** Limited projects or monthly scans, basic task extraction, demo-friendly board functionality, and manual review. This supports individual users and small teams while creating a low-friction adoption path.
- **Pro subscription:** Higher import and AI-scan limits, live Telegram reminders, scheduled nudges, richer project history, additional storage, and advanced accountability controls.
- **Team workspace subscription:** Per-seat or workspace-based pricing for shared projects, role-based access, collaborative review, centralized billing, and higher automation limits.
- **Education and community plans:** Affordable cohort, classroom, club, accelerator, or nonprofit packages where many small teams need lightweight accountability.
- **Business and enterprise plans:** Security controls, longer retention, audit history, service-level support, private deployment or regional data options, and custom integrations.
- **Usage-based AI and automation:** Charges or credit packs for unusually large imports, frequent rescans, high reminder volume, or premium AI workflows.
- **Integration and implementation services:** Paid onboarding, workflow configuration, data migration, and custom integrations for organizations adopting TaskGoblin across multiple teams.

The initial commercial focus will be a simple Pro and Team subscription. This provides recurring revenue while keeping infrastructure costs predictable through usage allowances. Pricing and packaging will be validated during pilots by measuring how much time teams save on manual project administration and how strongly TaskGoblin improves ownership clarity and deadline follow-through.
