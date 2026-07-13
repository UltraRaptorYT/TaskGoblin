from fastapi import FastAPI

from backend.models.calendar_models import CalendarEvent
from backend.calendar.calendar_reader import get_events
from backend.calendar.calendar_writer import create_event   

app = FastAPI()


@app.get("/")
def home():
    return {"message": "TaskGlobin API is running!"}


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/calendar/create-event")
def create_calendar_event(event: CalendarEvent):

    created = create_event(
        event.title,
        event.description,
        event.start,
        event.end,
    )

    return {
        "id": created["id"],
        "link": created["htmlLink"],
    }