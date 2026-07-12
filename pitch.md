# TaskGoblin Pitch Guide

## The One Sentence to Remember

> **TaskGoblin turns work buried in Telegram chats into an accountable project board.**

If you forget part of the script, return to that sentence. The judges should leave remembering three things:

1. Teams already assign important work in chat.
2. TaskGoblin uses AI to turn that chat into traceable tasks and accountability gaps.
3. The working MVP proves the scan-to-board workflow; live Telegram automation is the next milestone.

## Pitch Format

- **Main pitch:** 5 minutes
- **Live demo:** 75–90 seconds inside the pitch
- **Questions:** 2–3 minutes
- **Deck:** `public/taskgoblin-pitch.html`
- **Telegram demo:** `public/telegram.html`
- **Backup import:** `demo/safe-route-ai/result.json`

Aim to finish at approximately 4:40. The remaining time protects you from a slow transition or demo delay.

## Before You Present

- Replace `[Name]`, `[email]`, and `[project URL]` on the final slide.
- Open the pitch deck, Telegram demo, and TaskGoblin workspace in separate tabs.
- Put `demo/safe-route-ai/result.json` somewhere easy to select.
- Reset the Telegram demo before presenting if you added test messages.
- Preload a completed TaskGoblin scan in another tab as a fallback.
- Use fictional or sanitized conversation data only.
- Hide bookmarks, notifications, private tabs, API keys, and personal email addresses.
- Test the presentation at the same resolution and browser zoom used on stage.

## Five-Minute Speaker Script

### Slide 1 — Opening (0:00–0:25)

**Say:**

> “Your team agreed to do it. So why did nobody do it? This happens because important work is assigned in Telegram every day, but chat is chronological—not accountable. A deadline is mentioned once, ownership stays vague, someone sends a GIF, and the commitment disappears. TaskGoblin turns that chat chaos into work that gets done.”

**Delivery:** Pause after the opening question. Do not introduce every team member yet. Make eye contact before advancing.

### Slide 2 — Problem (0:25–0:55)

**Say:**

> “For student teams, startups, agencies, and community groups, the project plan is scattered across hundreds of messages. Tasks are implied, ownership is fuzzy, and following up becomes awkward. The alternative is copying everything into a separate project tool and constantly maintaining it. Most small teams do not do that consistently, so the problem appears at the worst possible time: the deadline.”

**Key emphasis:** The problem is the gap between conversation and execution, not a lack of task-management products.

### Slide 3 — Insight (0:55–1:15)

**Say:**

> “Teams do not need another empty task manager. They need a system that understands where their work already begins. That means extracting an actionable project state from the conversation, while preserving enough evidence for people to verify what the AI found.”

**Transition:** “Here is the workflow.”

### Slide 4 — Solution (1:15–1:40)

**Say:**

> “TaskGoblin works in four moves. First, import a Telegram Desktop export or project brief. Second, the AI extracts tasks, owners, dates, decisions, blockers, questions, and risks. Third, the team verifies confidence and source snippets on a shared board. Finally, they assign missing work and prepare the right accountability nudge.”

**Do not say:** That the live Telegram bot is fully complete. Reminder generation and staging work today; live delivery is the next milestone.

### Slide 5 — Live Demo (1:40–3:05)

Keep this section under 85 seconds.

#### Demo action 1: Show realistic chat chaos (15 seconds)

Open `public/telegram.html`. Point briefly to:

- The deadline and open deliverables.
- “Ten days is basically two weeks.”
- The “this is fine” GIF and skull sticker.
- The unassigned Scrum report.
- The final message containing explicit owners and deadlines.

**Say:**

> “This looks like a real team chat: useful updates mixed with jokes, replies, memes, vague promises, blockers, and eventually a serious plan. A human can reconstruct it, but doing that every day is administrative work.”

#### Demo action 2: Import and scan (15 seconds)

Export the Telegram demo or upload the prepared `result.json` to TaskGoblin.

**Say:**

> “We export the conversation and give it to TaskGoblin. It normalizes Telegram text and media records, then asks the AI for a structured project scan.”

If scanning takes longer than five seconds, switch immediately to the preloaded completed scan.

#### Demo action 3: Prove structured understanding (30 seconds)

Show the summary, health score, board lanes, and at least one risk or blocker.

Open one task with an owner and deadline, then show its confidence and source snippet.

**Say:**

> “Instead of returning another paragraph, TaskGoblin creates an editable project state. We can see what must happen, who owns it, what is blocked, and where information is missing. Confidence and source context let the team verify the extraction rather than blindly trusting it.”

#### Demo action 4: Close the accountability loop (20 seconds)

Select an unassigned task, add an owner or move its status, switch reminder tones, and stage a reminder.

**Say:**

> “The team can correct the board, assign a ghost task, and generate a professional, friendly, or Goblin-style follow-up. Reminder staging works in the MVP. The next integration milestone is delivering these automatically through the Telegram Bot API.”

Return to the deck.

### Slide 6 — Why the AI Matters (3:05–3:35)

**Say:**

> “This is different from asking a general chatbot to summarize a conversation. A summary is disposable. TaskGoblin produces persistent, editable project state. It uses structured outputs, keeps unknown owners and dates empty instead of inventing them, records confidence, preserves source evidence, and identifies execution risks such as ghost tasks, missing dates, and blocked dependencies.”

**Strong line:**

> “A summarizer tells you what people discussed. TaskGoblin tells you what must happen next and why.”

### Slide 7 — Opportunity (3:35–3:55)

**Say:**

> “We are starting with Telegram-native student teams, startup crews, agencies, volunteer groups, and communities. Telegram gives us a focused entry point through Desktop exports and future Bot API updates. Once the accountability model works for this workflow, the same project-intelligence layer can expand to more chat, document, calendar, and project-tool sources.”

Do not use unsupported market-size figures. Focus on a credible initial user group and expansion path.

### Slide 8 — Business Model (3:55–4:15)

**Say:**

> “The business model is freemium SaaS. The free tier helps small teams experience the scan and board. Pro adds higher AI limits, project history, and live reminder automation. Team plans add shared workspaces, access controls, centralized billing, and support. We will validate exact pricing during pilots based on time saved and improvements in on-time delivery.”

### Slide 9 — Progress and Roadmap (4:15–4:35)

**Say:**

> “The core MVP already works: Telegram and document import, structured AI scans, confidence and source traceability, an editable six-lane board, authentication and persistence foundations, and staged accountability messages. Next, we are completing bot delivery and account linking, running real-team pilots, and measuring whether TaskGoblin improves assignment clarity and deadline performance.”

**Be precise:** Never describe planned automation, billing, or continuous ingestion as completed.

### Slide 10 — Ask and Close (4:35–4:55)

**Say:**

> “We are looking for pilot teams, product and AI mentorship, and introductions to Telegram-native teams. We want to prove that TaskGoblin does more than create a good-looking board—we want to prove that it measurably improves ownership and on-time delivery. TaskGoblin turns Telegram chaos into work that gets done. Thank you.”

Stop speaking after “Thank you.” Do not dilute the ending with another explanation.

## Shorter 60-Second Version

> “Important project work is assigned in Telegram every day, but chat is chronological, not accountable. Tasks disappear, ownership stays vague, and teams discover missing work near the deadline. TaskGoblin turns Telegram exports and project briefs into a traceable project board. Its AI extracts tasks, owners, dates, decisions, blockers, questions, and risks using structured outputs, confidence, and source snippets. Teams review the result, assign ghost tasks, update status, and generate the right follow-up. The MVP already demonstrates import, AI scan, board editing, persistence foundations, and reminder staging. We are now completing live Telegram delivery and piloting with real teams. TaskGoblin is Jira for group chats: it turns chat chaos into work that gets done.”

## Demo Recovery Plan

If the import fails:

> “The live provider is taking longer than expected, so I will use the scan we prepared from this exact conversation.”

Switch to the preloaded completed scan. Do not debug on stage.

If OpenAI is unavailable, use TaskGoblin’s mock/demo fallback and state that it is a reliability fallback, not the production AI result.

If Telegram export download is blocked, upload `demo/safe-route-ai/result.json` directly.

If the entire application is unavailable, continue with Slide 5 and narrate the four demo actions using its three cards. The rest of the pitch still works.

## Likely Questions and Strong Answers

### “Why not just use ChatGPT?”

> “ChatGPT can produce a useful one-off summary. TaskGoblin creates a persistent project state: structured tasks, evidence, confidence, status, ownership, risks, and follow-up actions. The value is the accountable workflow around the model output.”

### “Why Telegram first?”

> “Telegram is already the working environment for many small and distributed teams. Desktop exports give us a consent-based historical import path, while the Bot API provides a path for future updates and delivery. It is a focused wedge, not the final integration boundary.”

### “Can your bot read old Telegram messages?”

> “No. Telegram bots cannot retroactively read a group’s history. Historical ingestion uses a user-provided Telegram Desktop export. Once connected, the bot can receive future updates permitted by Telegram and the group’s settings.”

### “How do you control hallucinations?”

> “We require schema-valid structured output, tell the model not to invent owners or dates, allow null values, attach confidence, preserve message IDs and source snippets, and keep a human review step before the result becomes the project record.”

### “What about privacy?”

> “Users choose what they upload, and demos use sanitized data. Production requirements include explicit consent, minimal bot permissions, access controls, encrypted transport, retention and deletion controls, and clear disclosure of third-party AI processing.”

### “Who pays?”

> “The likely buyer is the team lead, project owner, educator, agency, accelerator, or organization that bears the cost of missed deadlines and manual coordination. We will initially validate Pro and Team subscriptions.”

### “What is actually built?”

> “Import, normalization, structured AI scanning, an editable board, source traceability, authentication and database foundations, reminder generation, scheduling records, and a webhook scaffold. Live Telegram delivery, account linking, automated workers, billing, and production hardening are next.”

### “How will you prove value?”

> “We will measure extraction acceptance, corrections per scan, percentage of tasks assigned after review, time saved creating the board, reminder response, overdue-task reduction, and on-time completion.”

## Delivery Advice

- Speak slightly slower than normal during the first and final sentences.
- Avoid reading the slide text word for word.
- Explain user outcomes before implementation details.
- Use “working MVP” instead of “finished product.”
- State limitations confidently; a precise roadmap is more credible than an exaggerated claim.
- Spend the most time on the live transformation from noisy chat to traceable task.
- Practice until the demo feels conversational rather than memorized.
