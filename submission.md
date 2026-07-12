# TaskGoblin Project Submission

## Project Introduction*

TaskGoblin is a Telegram-first AI accountability workspace that turns messy project chats and documents into structured, actionable work. It is built for student teams, startup crews, agencies, volunteer groups, and other small teams that coordinate through chat but do not consistently maintain a formal project-management system.

Users can upload a Telegram Desktop `result.json` export, a Telegram export ZIP, or a project brief in PDF, DOCX, Markdown, or plain-text format. TaskGoblin normalizes the source material and uses AI to extract tasks, owners, deadlines, decisions, unanswered questions, blockers, and delivery risks. The team reviews the result on a lightweight Kanban board, checks confidence and source snippets, assigns missing owners, updates deadlines and statuses, and sends accountability reminders.

The current product surface includes:

- Google authentication through Supabase and a keyless demo mode.
- Separate project workspaces with cached demo projects.
- Telegram JSON/ZIP and project-document ingestion.
- OpenAI-powered structured project scans with mock fallbacks.
- A six-lane board covering Backlog, To Do, Doing, Blocked, Overdue, and Done.
- Drag-and-drop task movement and editable owners, deadlines, and statuses.
- Dynamic project health, score, unassigned-task, and blocked-task metrics.
- AI extraction of decisions, questions, blockers, risks, and source evidence.
- Professional, Friendly, and Goblin accountability-message tones.
- Telegram Bot API delivery to a configured chat, webhook-secret verification, and `/start` and `/help` bot commands.
- Supabase persistence for projects, imports, messages, scans, tasks, reminders, and notification-delivery records.

TaskGoblin can be described as “Jira for group chats.” It converts unstructured coordination into visible ownership and follow-through without requiring every teammate to manually maintain another complex tool.

## Project Logo URL (Optional)

Not yet published at a permanent public URL. The current logo asset is stored at `public/brand/taskgoblin-logo.png` in the project repository.

## Official Twitter / X (Optional)

Not yet established.

## Official Discord (Optional)

Not yet established.

## Official Telegram (Optional)

https://t.me/taskgoblin_launch_bot

## Primary Contact Person, Email, Position*

Soh Hong Yu, sohhongyu@gmail.com, Founder and Product Lead of TaskGoblin

## Secondary Contact Person, Email, Position (Optional)

Not applicable. TaskGoblin is currently a solo-founder project.

## Core Team Members' Background*

**Soh Hong Yu, Founder and Product Lead**

Hong Yu is an AI and software engineer from Singapore and an incoming National University of Singapore Computer Science student, where he will also pursue a Minor in Entrepreneurship. He graduated from Singapore Polytechnic with a Diploma in Applied AI and Analytics, a CGPA of 3.97, 15 Distinctions, and a place on the Director's Honour Roll.

He previously worked for 14 months as a Software Engineer in GovTech Singapore's Cybersecurity Group. His work included CloudSCAPE, a React, Kibana, and Elasticsearch compliance dashboard, and a Terraformer library that reverse-engineered AWS and Azure infrastructure into Infrastructure as Code for compliance scanning. At Singapore's Ministry of Education, he automated HR workflows using UiPath, Python, and VBA, reducing one process from three hours to under one hour.

Hong Yu has extensive experience building practical AI systems and end-to-end products. His PolyFinTech 2023 team won Champion with Singen, an AI text-to-video pipeline combining a language model, ElevenLabs, and FFmpeg for financial education. His hackathon record also includes Best Pre-University Hack at NUS Hack&Roll in both 2024 and 2025, Most Entertaining Hack in 2026, and podium finishes at the Singapore FinTech Festival and NUS ReWired Hackathon.

His community work directly informs TaskGoblin. Hong Yu has volunteered with BW Monastery since age 13 and has helped coordinate programmes serving more than 300 students with around 50 volunteers. He has built attendance, event, and game systems for non-technical users, including a Next.js and Supabase cooperative game used by more than 80 camp participants. He is also an advisor and former Vice President of Singapore Youth AI, a community with more than 700 members.

Hong Yu is responsible for TaskGoblin's product direction, user experience, AI extraction pipeline, application engineering, database architecture, Telegram integration, deployment, and business validation. His strength is identifying broken operational workflows and building practical technology that non-technical users can adopt.

## Project Innovation (Related to AI)*

TaskGoblin treats AI as an operational accountability layer instead of a general-purpose chat interface. Its core innovation is converting long, noisy, chronological conversations into a persistent and reviewable project state.

The pipeline first normalizes Telegram exports and project documents into a consistent transcript. It then uses structured model outputs to extract tasks, owners, deadlines, decisions, unresolved questions, blockers, risks, confidence values, project health, and reminder suggestions. The model is explicitly instructed not to invent unsupported owners or dates. Unknown facts remain empty, uncertain extractions receive lower confidence, and source message IDs and snippets are retained wherever possible.

This traceability is important because TaskGoblin is not asking users to trust an opaque summary. Users can inspect the evidence behind an AI-generated task, correct the result, and manage it as part of an ongoing project board.

TaskGoblin also detects accountability gaps that conventional summarizers often miss. It identifies ghost tasks without owners, missing deadlines, vague promises, blocked dependencies, stale work, and overdue commitments. Its reminder agent then generates context-aware follow-ups in Professional, Friendly, or Goblin Mode and can deliver them through Telegram.

The longer-term innovation is a continuously updated project memory. With user consent and appropriate Telegram permissions, new messages can be reconciled against the existing board, decisions, and commitments. This moves the product beyond repeated one-off summaries towards an AI-native system that understands how a project changes over time and prompts the next useful action.

## Pain Point Solved*

Many small teams already run their projects through Telegram and other group chats. Decisions are mixed with casual conversation, responsibilities are implied instead of assigned, deadlines are buried, and important requests quickly scroll out of view.

Traditional project-management tools solve part of the problem but create a second workflow. Someone must manually copy information from chat, create tickets, assign owners, keep statuses current, and chase teammates for updates. Smaller or less formal teams often do not have a dedicated project manager, so this administration is inconsistent or does not happen at all.

The pain becomes most visible near a deadline. Teams discover that a task had no owner, two people interpreted a decision differently, a dependency was blocked for days, or a report everyone had seen was never actually claimed. The cost includes missed deadlines, duplicated work, interpersonal friction, lower stakeholder trust, and time spent reconstructing what the team agreed to do.

TaskGoblin closes the gap between conversation and execution. It meets teams where their work already happens, converts the existing context into a reviewable board, and makes missing ownership and delivery risk visible. Teams gain a shared view of who owns what, what is late or blocked, why each task exists, and who needs a timely follow-up.

## Current Development Progress*

TaskGoblin currently has a functional MVP built with Next.js 16, React 19, Supabase, OpenAI, and the Telegram Bot API.

Completed capabilities include:

- Telegram Desktop JSON and ZIP parsing, including rich-text arrays, service messages, and media-bearing records.
- PDF, DOCX, Markdown, and plain-text project-brief ingestion.
- Vercel-compatible server-side PDF text extraction.
- OpenAI structured extraction with a schema-valid mock fallback for demonstrations.
- Separate project workspaces and a responsive six-lane Kanban board.
- Drag-and-drop task management and editable owners, deadlines, and statuses.
- Dynamic management metrics that recalculate project health, score, blocked work, and unassigned work after task changes.
- Source snippets, source message IDs, and extraction-confidence values.
- Supabase authentication, PostgreSQL persistence, and a row-level-security-oriented schema.
- AI-generated accountability messages in three tones.
- Telegram Bot API message sending to a configured reminder chat.
- Telegram webhook-secret validation, incoming-update storage, and basic `/start` and `/help` commands.
- Reminder and delivery-status persistence.
- Demo fallbacks that keep the main workflow usable without provider credentials.

The next milestones are:

1. Replace the single configured reminder chat with proper per-user and per-project Telegram account linking.
2. Add a scheduled reminder worker with retries, delivery monitoring, and failure recovery.
3. Process future bot-visible Telegram updates and reconcile them against existing project tasks.
4. Complete multi-user workspace membership, roles, invitations, and project access controls.
5. Expand automated tests for imports, structured AI output, authorization, task changes, and Telegram delivery.
6. Run pilots with real project teams and measure extraction acceptance, correction rates, assignment clarity, reminder response, overdue-task reduction, and on-time completion.
7. Add production monitoring, onboarding, usage limits, billing, and administrative controls.

The MVP demonstrates the complete core loop from unstructured source material to a traceable project board and Telegram accountability action. The main work before a broader launch is production-grade user linking, scheduled automation, multi-user collaboration, and validation with real teams.

## Expected Revenue Sources*

TaskGoblin is expected to use a freemium SaaS model with pricing aligned to team size, AI usage, project volume, and automation needs.

- **Free plan:** A limited number of projects and monthly scans, core task extraction, board review, and manual project management. This creates a low-friction entry point for individuals and small teams.
- **Pro subscription:** Higher AI and import limits, project history, scheduled Telegram reminders, richer accountability controls, and additional storage.
- **Team workspace subscription:** Per-seat or workspace-based pricing for shared projects, role-based access, collaboration, centralized billing, higher automation limits, and administrative controls.
- **Education and community plans:** Affordable cohort, classroom, club, accelerator, volunteer-group, or nonprofit packages where many small teams require lightweight accountability.
- **Business and enterprise plans:** Audit history, security controls, configurable retention, priority support, regional or private deployment options, and custom integrations.
- **Usage-based AI and automation:** Additional credits for unusually large imports, frequent rescans, high reminder volume, or premium project-intelligence workflows.
- **Implementation and integration services:** Paid onboarding, workflow configuration, data migration, and custom integrations for organizations adopting TaskGoblin across multiple teams.

The initial commercial focus will be simple Pro and Team subscriptions. Pricing will be validated through pilots by measuring the administrative time saved and whether TaskGoblin improves ownership clarity, reminder response, and on-time delivery. Recurring subscriptions combined with usage allowances provide a sustainable model while keeping AI and infrastructure costs predictable.
