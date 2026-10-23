export const CHECK_IN_DAYS = [
  { value: "SU", label: "Sunday", day: 0 },
  { value: "MO", label: "Monday", day: 1 },
  { value: "TU", label: "Tuesday", day: 2 },
  { value: "WE", label: "Wednesday", day: 3 },
  { value: "TH", label: "Thursday", day: 4 },
  { value: "FR", label: "Friday", day: 5 },
  { value: "SA", label: "Saturday", day: 6 },
] as const;

export type CheckInDay = (typeof CHECK_IN_DAYS)[number]["value"];

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function createWeeklyCheckInCalendar(
  day: CheckInDay,
  appUrl: string,
  now = new Date(),
): string {
  const selectedDay = CHECK_IN_DAYS.find((option) => option.value === day);
  if (!selectedDay) throw new Error("Invalid check-in day.");

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9);
  start.setDate(start.getDate() + ((selectedDay.day - start.getDay() + 7) % 7));
  if (
    start.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9).getTime() &&
    now.getHours() >= 9
  ) {
    start.setDate(start.getDate() + 7);
  }
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 15);

  const uid = `slothsteps-${now.getTime()}-${Math.random().toString(36).slice(2)}@local`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SlothSteps//Weekly Check-in//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatLocalDateTime(start)}`,
    `DTEND:${formatLocalDateTime(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${day}`,
    "SUMMARY:SlothSteps weekly check-in",
    `DESCRIPTION:${escapeCalendarText("A gentle reminder to check in on this week's tiny step.")}`,
    `URL:${appUrl}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT0M",
    `DESCRIPTION:${escapeCalendarText("Time for your SlothSteps check-in.")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.join("\r\n")}\r\n`;
}
