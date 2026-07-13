"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { getCalendarEvents } from "@/lib/api";

type CalendarEvent = {
  id?: string;
  summary?: string;
  title?: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
};

export default function GoogleCalendarCard() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const now = new Date();

        const start = new Date(now);
        start.setHours(0, 0, 0, 0);

        const end = new Date(now);
        end.setHours(23, 59, 59, 999);

        const data = await getCalendarEvents(
          start.toISOString(),
          end.toISOString()
        );

        setEvents(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-white">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={22} />
        <h2 className="text-xl font-semibold">Google Calendar</h2>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : events.length === 0 ? (
        <p>No events today.</p>
      ) : (
        events.map((event, index) => (
          <div
            key={index}
            className="border-b py-3 last:border-b-0"
          >
            <h3 className="font-medium">
              {event.summary ?? event.title}
            </h3>

            <p className="text-sm text-gray-500">
              {event.start.dateTime}
            </p>
          </div>
        ))
      )}
    </div>
  );
}