# TaskGoblin — Launchpad 2026 Submission

> Working draft for the five judging pillars. Maximum 1,000 words excluding
> appendices. Replace every `[MEASURE]` field before submission; do not turn
> placeholders into unsupported claims.

## Positioning

TaskGoblin is a constrained agentic application that turns Telegram project
conversations into persistent, reviewable project state.

Its central insight is that small teams do not fail because task-management
software is unavailable. They fail because commitments begin in informal
conversation, while maintaining a separate structured system requires work
that nobody consistently performs. TaskGoblin closes that gap without allowing
an AI model to silently rewrite the project record.

## Submission Draft

### Problem

Small project teams already coordinate through Telegram. Requests, decisions,
deadlines and progress updates appear alongside jokes, acknowledgements and
unrelated conversation. Chat is effective for communication but chronological,
not accountable: a commitment can scroll away without becoming visible work.

Traditional project-management tools create a second workflow. Someone must
copy information from chat, create tasks, resolve owners, update deadlines and
chase progress. Short-term student, startup and volunteer teams often lack a
dedicated project manager, so this administration is incomplete or abandoned.
A generic chatbot summary also falls short because it is disposable text rather
than an auditable project state.

We defined success as enabling a team to continue speaking naturally while
reducing the time needed to identify outstanding work, without inventing owners
or deadlines. We measure this through task-event precision and recall, owner and
task matching accuracy, time to reconstruct project state, correction rate and
successful follow-through after reminders.

### Approach

TaskGoblin lives inside a Telegram group. Each visible message is normalised and
stored with its Telegram source ID. Deterministic routing handles commands and
known operations. OpenAI Structured Outputs classify less predictable messages
as task proposals, assignments, progress updates, possible completions,
deadline changes, blockers or decisions. The detector receives current tasks,
known group members, recent messages and processed project documents.

The system behaves as a constrained agent rather than a single unrestricted
model call. It retrieves project context, selects an action, matches mentions
against known members, checks existing tasks and duplicates, and may use tools
to propose several tasks or answer a project question. Model text cannot
directly mutate the database. Consequential inferences are persisted as
candidates and normally shown through Telegram confirmation controls before
they change project state. A confidently matched explicit completion uses a
controlled exception: TaskGoblin reacts to the source message, records the
completing member as owner, and keeps the change reversible through `/undo`.
The website provides a secondary Kanban, calendar and correction surface;
Telegram remains the primary workflow.

The current bot command surface is deliberately small: `/start`, `/help`,
`/summary`, `/project`, `/kpi`, `/tasks`, `/mytasks` and `/undo`. Task selection and
candidate review continue through inline Telegram buttons. Commands such as
`/recent`, `/addtask`, `/done`, `/update`, `/setproject` and `/addmilestone`
are roadmap ideas, not features of the submitted prototype.

We rejected three simpler alternatives. Manual task entry preserves accuracy
but restores the administrative friction we are trying to remove. Full-chat
rescanning repeatedly processes old information, costs more and risks duplicate
tasks; per-message detection instead reconciles each event against persistent
state. Fully autonomous mutation appears smoother but makes ambiguous chat
unsafe. Human confirmation is therefore deliberate, not an unfinished part of
the agent.

We also deliberately limited the prototype to Telegram, structured project
events and reminders. It is not a Jira replacement or an autonomous coding
agent. This scope lets us test whether conversational project memory is useful
before adding broader planning or integrations.

### Evidence

Our evaluation compares TaskGoblin with two baselines: manually reading the
same conversation, and a single LLM call without persistent project state or
tools. On an unseen set of `[MEASURE: N]` realistic messages across assignments,
suggestions, jokes, duplicate messages, ambiguous owners, relative deadlines
and completion claims, TaskGoblin achieved `[MEASURE]` precision, `[MEASURE]`
recall and `[MEASURE]` owner/task-match accuracy. The single-call baseline
achieved `[MEASURE]`, showing whether orchestration contributes beyond model
quality.

In a timed reconstruction study with `[MEASURE: N]` participants and
`[MEASURE: N]` conversations, users identified outstanding work in
`[MEASURE]` minutes with TaskGoblin versus `[MEASURE]` manually. We additionally
recorded candidate acceptance, correction, duplicate and reminder-response
rates.

The repository has over 100 automated tests covering webhook validation,
update normalisation, commands, callbacks, event detection, documents,
permissions and web task operations. This establishes engineering correctness,
not user value; the user study and held-out comparison support the product
claims.

### Constraints

Precision and recall conflict. Aggressive detection captures more commitments
but false tasks quickly damage trust, so the prototype prefers no event when a
message is ambiguous. Owners resolve only against known group members, and
possible completions and deadline changes must match an existing task.

AI processing adds cost and latency. Deterministic commands bypass the model,
rapid messages are briefly coalesced, and mock mode supports development without
provider keys. We will report median and p95 response latency, cost per 1,000
messages and the percentage of messages handled without AI. Two production
diagnostics took 1.9 seconds for deterministic processing and 9.5 seconds for an
OpenAI event call; these illustrate the range but are not a benchmark.

Telegram bots cannot read historical messages retroactively and group privacy
settings affect which messages are visible. The bot therefore processes future
permitted updates, while user-provided documents provide explicit reference
context. Webhook secrets, restricted service credentials, row-level security,
source traceability and confirmation boundaries reduce operational and safety
risk. Retention and deletion controls remain necessary before broad deployment.

### Honesty & Trajectory

The prototype still misinterprets fragmented, informal or highly contextual
conversation. Early versions lost context across rapid messages, rejected
relative deadline wording, treated bulk assignment as a single event and could
not understand a private reminder follow-up unless the user pressed Telegram's
Reply button. PDF processing also failed on Vercel until its worker dependency
was made serverless-compatible. These failures shaped batching, persistent
context, deterministic action routing and reviewable state transitions.

Human confirmation reduces unsafe changes but introduces interaction cost.
Project context can become stale, reminder advice is only as useful as the
stored tasks, and the current fixture set cannot prove performance across teams
or languages.

With two more weeks, we would freeze an anonymised evaluation set, run the
single-call baseline, measure latency and cost by route, conduct a multi-team
task-reconstruction study, analyse rejected and corrected candidates, and add
explicit retention controls. We would improve the architecture only where
these measurements identify a real failure.

---

## Appendix A — Evidence Required

| Claim | Metric | Baseline | Required reporting |
|---|---|---|---|
| Detects actionable events | Precision, recall and F1 by event type | Single-call LLM | Dataset size, class balance and confusion matrix |
| Resolves project context | Owner and existing-task match accuracy | Name matching without stored context | Ambiguous and unknown-member cases |
| Saves coordination time | Time to reconstruct outstanding work | Manual Telegram reading | Participants, mean, median and variance |
| Avoids noisy automation | Candidate acceptance and correction rates | Auto-create without confirmation | Rejected, edited and duplicate candidates |
| Responds within practical limits | p50/p95 latency by route | Deterministic-only and single-call routes | Warm/cold runs and failure rate |
| Has viable operating cost | Cost per message and per active project | Chosen baseline model | Model, token use and messages bypassing AI |
| Improves follow-through | Reminder response and completion rates | No-reminder group or before/after period | Observation window and sample size |

## Appendix B — Decision Log

| Decision | Chosen approach | Alternative rejected | Reason |
|---|---|---|---|
| Primary interface | Telegram-native bot | Upload-first web application | Keeps work where conversation happens |
| Processing unit | Per-message events with bounded context | Repeated full-transcript scans | Lower duplication, latency and cost |
| State changes | Persist candidate, then confirm | Direct model mutation | Ambiguous chat requires an audit boundary |
| Commands | Deterministic routing | Send every command to an LLM | Faster, cheaper and predictable |
| Owner resolution | Known group members only | Model-generated names | Prevents invented or unauthorised owners |
| Website role | Secondary board and calendar | Website as primary workspace | Avoids creating another mandatory workflow |
| Platform scope | Telegram first | Telegram and WhatsApp together | Focused, testable bot integration |

## Appendix C — Negative Results and Failure Modes

- Telegram privacy mode prevented ordinary group-message ingestion.
- A webhook secret mismatch produced `401` responses.
- PDF.js attempted to load a missing worker on Vercel.
- Full or isolated messages lost multi-message conversational intent.
- Single-event schemas could not represent multi-task assignment.
- Gerunds and relative deadlines caused valid task updates to be rejected.
- Private reminder follow-ups had no project context without an explicit reply.
- Slow AI calls created poor perceived responsiveness even when the webhook did
  not time out.
- A candidate can still be wrong after schema validation; structured output is
  not equivalent to semantic correctness.

## Appendix D — Two-Week Execution Plan

1. Freeze and document an anonymised held-out dataset.
2. Implement and run the single-call baseline on the same examples.
3. Report per-type confusion matrices and trajectory-level failures.
4. Instrument route, model, token, cost and latency measurements.
5. Run timed reconstruction tests with several real project teams.
6. Analyse confirmation, correction, duplicate and reminder-response rates.
7. Add retention, deletion and project-export controls.
8. Revise claims and scope according to the measured results.

## Appendix E — Current Demonstrable Feature Surface

### Telegram

- Greets and provisions a project group when the bot is added.
- Links members when they say `hello`; private chat `/start` enables direct
  reminders.
- Supports `/start`, `/help`, `/summary`, `/project`, `/kpi`, `/tasks`,
  `/mytasks` and `/undo`.
- Detects task proposals, explicit assignments, progress, possible
  completions, deadline changes, blockers and decisions from permitted group
  messages.
- Persists source-linked candidates and asks users to Confirm, Edit or Ignore
  consequential changes with inline buttons.
- Can propose and confirm several tasks as one reviewed batch.
- Reads PDF, DOCX, TXT and MD files up to 15 MB as bounded project context;
  scanned PDFs need OCR first.
- Coalesces short bursts of messages before AI processing and retains recent
  project context.
- Sends scheduled private Telegram reminders and grounds reminder follow-up
  advice in the relevant task, project and stored documents.
- Sends a deduplicated project report to active groups at 8pm Singapore time,
  covering progress, urgent work, owners, blockers and the next seven days.
- Reacts to confidently matched explicit completion messages, marks the task
  complete and attributes ownership to the member who completed the work.
- Keeps task mutation history so `/undo` can restore the previous task state.
- Links command and agent responses back to the relevant project dashboard.

### Website

- Uses Telegram web authentication and filters projects by known group
  membership.
- Shows project progress, task counts, members, review state and calculated
  health.
- Provides list, Kanban board and calendar views.
- Allows authorised users to create tasks and edit task details, owner,
  deadline, priority and status.
- Retains the legacy project-brief import flow.

### Not in the Current Prototype

- `/recent`, `/addtask`, `/done`, `/update`, `/setproject` and
  `/addmilestone` commands.
- Autonomous code execution or a hosted coding-agent runtime.
- Retroactive access to Telegram messages sent before the bot could receive
  them.
- OCR for image-only or scanned PDFs.
- Automatic, unreviewed mutation of consequential project state from model
  output.
