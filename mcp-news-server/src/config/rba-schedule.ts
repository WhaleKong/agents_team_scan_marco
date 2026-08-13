// RBA Monetary Policy Board decision dates — the SECOND day of each two-day
// meeting, expressed in Sydney local time. The cash rate decision is announced
// at 14:30 Sydney; the Governor's press conference follows at 15:30.
//
// Source of truth: https://www.rba.gov.au/schedules-events/board-meeting-schedules.html
// (rba.gov.au blocks automated fetches — verified 2026-08-13 against the RBA
// media release "2026 Monetary Policy Board Meeting Dates" as reported by two
// independent outlets, and cross-checked against the 2026-08-11 hold at 4.35%.)
//
// The Board meets 8 times a year (since the 2024 reform, down from 11).
// Extend this list when the RBA publishes a new year — the release-calendar
// tool warns when a requested window runs past the last entry.
//
// Store SYDNEY dates, never UTC or ET: Australian and US daylight saving run in
// opposite halves of the year, so the Sydney->ET offset swings between 14h and
// 16h. The calendar derives ET from the IANA database at render time; hand-
// converting here would bake in the DST mistakes this list exists to avoid.
export const RBA_DECISION_DATES_SYDNEY: string[] = [
  "2026-02-03",
  "2026-03-17",
  "2026-05-05",
  "2026-06-16",
  "2026-08-11",
  "2026-09-29",
  "2026-11-03",
  "2026-12-08",
];

/** Local announcement time in Australia/Sydney, 24h "HH:MM". */
export const RBA_ANNOUNCEMENT_TIME_SYDNEY = "14:30";

export const RBA_TIME_ZONE = "Australia/Sydney";
