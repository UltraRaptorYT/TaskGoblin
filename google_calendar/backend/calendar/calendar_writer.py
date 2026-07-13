    
from backend.calendar.auth import get_calendar_service


def create_event(title, description, start, end):

    service = get_calendar_service()

    event = {
        "summary": title,
        "description": description,
        "start": {
            "dateTime": start,
            "timeZone": "Asia/Singapore",
        },
        "end": {
            "dateTime": end,
            "timeZone": "Asia/Singapore",
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {
                    "method": "popup",
                    "minutes": 30,
                },
                {
                    "method": "popup",
                    "minutes": 1440,
                },
            ],
        },
    }

    created_event = (
        service.events()
        .insert(calendarId="primary", body=event)
        .execute()
    )

    return created_event    