from pydantic import BaseModel


class CalendarEvent(BaseModel):
    title: str
    description: str
    start: str
    end: str