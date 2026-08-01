"use client";

import { BellRing, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TelegramProjectReportSettings } from "@/lib/telegram-web-data";

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const commonTimezones = [
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Jakarta",
  "Asia/Manila",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export function ProjectReportSettings({
  projectId,
  initialSettings,
  canEdit,
}: {
  projectId: string;
  initialSettings: TelegramProjectReportSettings;
  canEdit: boolean;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timezoneOptions = commonTimezones.includes(settings.timezone)
    ? commonTimezones
    : [settings.timezone, ...commonTimezones];

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/dashboard/projects/${projectId}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { settings?: TelegramProjectReportSettings; error?: string }
        | null;
      if (!response.ok || !payload?.settings) {
        throw new Error(payload?.error ?? "Could not update the report schedule.");
      }
      setSettings(payload.settings);
      setMessage("Report schedule saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update the report schedule.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-[#102219] p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#dfff64]/12 text-[#dfff64]">
          <BellRing className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-black">Telegram reports</h2>
          <p className="mt-1 text-xs leading-5 text-[#91a096]">
            Send progress, urgent work, owners and blockers to the project group.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3">
          <span>
            <span className="block text-xs font-black">Automatic reports</span>
            <span className="mt-0.5 block text-[11px] text-[#91a096]">
              Pause without deleting the schedule.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.reportEnabled}
            disabled={!canEdit}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                reportEnabled: event.target.checked,
              }))
            }
            className="size-4 accent-[#dfff64]"
          />
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="report-frequency" className="text-xs text-[#aabbb0]">
            Frequency
          </Label>
          <Select
            value={settings.reportFrequency}
            disabled={!canEdit || !settings.reportEnabled}
            onValueChange={(value: "daily" | "weekly") =>
              setSettings((current) => ({
                ...current,
                reportFrequency: value,
              }))
            }
          >
            <SelectTrigger id="report-frequency" className="border-white/10 bg-black/15">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {settings.reportFrequency === "weekly" ? (
          <div className="space-y-1.5">
            <Label htmlFor="report-weekday" className="text-xs text-[#aabbb0]">
              Weekday
            </Label>
            <Select
              value={String(settings.reportWeekday)}
              disabled={!canEdit || !settings.reportEnabled}
              onValueChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  reportWeekday: Number(value),
                }))
              }
            >
              <SelectTrigger id="report-weekday" className="border-white/10 bg-black/15">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekdays.map((day, index) => (
                  <SelectItem key={day} value={String(index)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="report-time" className="text-xs text-[#aabbb0]">
            Local send time
          </Label>
          <Input
            id="report-time"
            type="time"
            step={300}
            value={settings.reportLocalTime}
            disabled={!canEdit || !settings.reportEnabled}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                reportLocalTime: event.target.value,
              }))
            }
            className="border-white/10 bg-black/15"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="report-timezone" className="text-xs text-[#aabbb0]">
            Timezone
          </Label>
          <Select
            value={settings.timezone}
            disabled={!canEdit || !settings.reportEnabled}
            onValueChange={(value) =>
              setSettings((current) => ({ ...current, timezone: value }))
            }
          >
            <SelectTrigger id="report-timezone" className="border-white/10 bg-black/15">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timezoneOptions.map((timezone) => (
                <SelectItem key={timezone} value={timezone}>
                  {timezone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canEdit ? (
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="w-full bg-[#dfff64] text-[#173d2b] hover:bg-[#e8ff8f]"
          >
            <Save className="size-3.5" />
            {saving ? "Saving…" : "Save schedule"}
          </Button>
        ) : (
          <p className="text-[11px] leading-5 text-[#91a096]">
            Only Telegram group owners and administrators can change this.
          </p>
        )}

        {message ? (
          <p role="status" className="text-xs leading-5 text-[#dfff64]">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
