import { z } from "zod";

const confidenceSchema = z.number().min(0).max(1);
const rationaleSchema = z.string().min(1).max(300);
const summarySchema = z.string().min(1).max(240);
const taskIdSchema = z.string().min(1).max(100);
const usernameSchema = z.string().min(1).max(64);
const deadlineTextSchema = z.string().min(1).max(100);

export const noProjectEventSchema = z.strictObject({
  eventType: z.literal("none"),
  confidence: confidenceSchema,
  rationale: rationaleSchema,
});

export const taskProposalEventSchema = z.strictObject({
  eventType: z.literal("task_proposal"),
  title: summarySchema,
  ownerUsername: usernameSchema.nullable(),
  deadlineText: deadlineTextSchema.nullable(),
  confidence: confidenceSchema,
  rationale: rationaleSchema,
});

export const explicitTaskAssignmentEventSchema = z.strictObject({
  eventType: z.literal("explicit_task_assignment"),
  title: summarySchema,
  ownerUsername: usernameSchema,
  deadlineText: deadlineTextSchema.nullable(),
  confidence: confidenceSchema,
  rationale: rationaleSchema,
});

export const taskProgressUpdateEventSchema = z.strictObject({
  eventType: z.literal("task_progress_update"),
  summary: summarySchema,
  matchedTaskId: taskIdSchema.nullable(),
  confidence: confidenceSchema,
  rationale: rationaleSchema,
});

export const possibleTaskCompletionEventSchema = z.strictObject({
  eventType: z.literal("possible_task_completion"),
  summary: summarySchema,
  matchedTaskId: taskIdSchema.nullable(),
  confidence: confidenceSchema,
  rationale: rationaleSchema,
});

export const deadlineUpdateEventSchema = z.strictObject({
  eventType: z.literal("deadline_update"),
  summary: summarySchema,
  matchedTaskId: taskIdSchema.nullable(),
  deadlineText: deadlineTextSchema.nullable(),
  confidence: confidenceSchema,
  rationale: rationaleSchema,
});

export const blockerEventSchema = z.strictObject({
  eventType: z.literal("blocker"),
  summary: summarySchema,
  matchedTaskId: taskIdSchema.nullable(),
  blockerText: z.string().min(1).max(240),
  confidence: confidenceSchema,
  rationale: rationaleSchema,
});

export const decisionEventSchema = z.strictObject({
  eventType: z.literal("decision"),
  summary: summarySchema,
  decisionText: z.string().min(1).max(500),
  confidence: confidenceSchema,
  rationale: rationaleSchema,
});

export const modelProjectEventSchema = z.discriminatedUnion("eventType", [
  noProjectEventSchema,
  taskProposalEventSchema,
  explicitTaskAssignmentEventSchema,
  taskProgressUpdateEventSchema,
  possibleTaskCompletionEventSchema,
  deadlineUpdateEventSchema,
  blockerEventSchema,
  decisionEventSchema,
]);

export const modelProjectEventResponseSchema = z.strictObject({
  result: modelProjectEventSchema,
});

export type NoProjectEvent = z.infer<typeof noProjectEventSchema>;
export type TaskProposalEvent = z.infer<typeof taskProposalEventSchema>;
export type ExplicitTaskAssignmentEvent = z.infer<
  typeof explicitTaskAssignmentEventSchema
>;
export type TaskProgressUpdateEvent = z.infer<
  typeof taskProgressUpdateEventSchema
>;
export type PossibleTaskCompletionEvent = z.infer<
  typeof possibleTaskCompletionEventSchema
>;
export type DeadlineUpdateEvent = z.infer<typeof deadlineUpdateEventSchema>;
export type BlockerEvent = z.infer<typeof blockerEventSchema>;
export type DecisionEvent = z.infer<typeof decisionEventSchema>;
export type ModelProjectEvent = z.infer<typeof modelProjectEventSchema>;

export type ProjectEventType = Exclude<ModelProjectEvent["eventType"], "none">;
