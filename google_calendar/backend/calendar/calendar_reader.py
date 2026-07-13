from backend.calendar.auth import get_calendar_service


def get_events(start_datetime, end_datetime):
   
    service = get_calendar_service()

    events_result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=start_datetime,
            timeMax=end_datetime,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )

    events = []
    
    for item in events_result.get("items", []):
        event = {
            "title": item.get("summary"),
            "start": item["start"].get("dateTime", item["start"].get("date")),
            "end": item["end"].get("dateTime", item["end"].get("date")),
            "location": item.get("location"),
        }
        events.append(event)

    return events