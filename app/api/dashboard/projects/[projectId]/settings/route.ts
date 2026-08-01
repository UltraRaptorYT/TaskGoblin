import { NextResponse } from "next/server";
import { z } from "zod";

import { getTelegramProjectAdminAccess } from "@/lib/telegram-web-permissions";

const reportSettingsSchema = z
  .object({
    reportEnabled: z.boolean(),
    reportFrequency: z.enum(["daily", "weekly"]),
    reportLocalTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Choose a valid local time."),
    reportWeekday: z.number().int().min(0).max(6),
    timezone: z.string().trim().min(1).max(100),
  })
  .strict()
  .superRefine((input, context) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timezone }).format();
    } catch {
      context.addIssue({
        code: "custom",
        path: ["timezone"],
        message: "Choose a valid IANA timezone.",
      });
    }
  });

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/dashboard/projects/[projectId]/settings">,
) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Cross-origin project updates are not allowed." },
      { status: 403 },
    );
  }

  const { projectId } = await context.params;
  const access = await getTelegramProjectAdminAccess(projectId);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const parsed = reportSettingsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid project report settings.",
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const { data: project, error } = await access.admin
    .from("taskgoblin_projects")
    .update({
      report_enabled: input.reportEnabled,
      report_frequency: input.reportFrequency,
      report_local_time: `${input.reportLocalTime}:00`,
      report_weekday: input.reportWeekday,
      timezone: input.timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select(
      "report_enabled, report_frequency, report_local_time, report_weekday, timezone",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { error: auditError } = await access.admin
    .from("taskgoblin_project_events")
    .insert({
      project_id: projectId,
      event_type: "web_report_settings_updated",
      title: "Updated project report schedule",
      metadata: {
        reportEnabled: project.report_enabled,
        reportFrequency: project.report_frequency,
        reportLocalTime: project.report_local_time,
        reportWeekday: project.report_weekday,
        timezone: project.timezone,
        editedByTelegramUserRecordId:
          access.identity.telegramUserRecordId,
        source: "web_dashboard",
      },
    });
  if (auditError) {
    console.error("Could not audit report settings update", auditError);
  }

  return NextResponse.json({
    settings: {
      reportEnabled: project.report_enabled,
      reportFrequency: project.report_frequency,
      reportLocalTime: String(project.report_local_time).slice(0, 5),
      reportWeekday: project.report_weekday,
      timezone: project.timezone,
    },
    auditPersisted: !auditError,
  });
}
