const API_BASE = "http://localhost:8000";

export async function getCalendarEvents(start: string, end: string) {
  const response = await fetch(
    `${API_BASE}/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch calendar events");
  }

  return response.json();
}

export async function createCalendarEvent(event: {
  title: string;
  description: string;
  start: string;
  end: string;
}) {
  const response = await fetch(`${API_BASE}/calendar/create-event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error("Failed to create calendar event");
  }

  return response.json();
}