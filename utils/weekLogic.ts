// utils/weekLogic.ts
// Week-level utilities for the attendance engine

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type DayName = typeof DAYS[number];

/**
 * Returns ISO week ID string, e.g. "2026-W08"
 * Week starts on Monday per ISO 8601.
 */
export function getWeekId(date: Date = new Date()): string {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	// ISO week: adjust to nearest Thursday
	d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Returns today's day name, e.g. "Monday"
 */
export function getTodayName(): DayName {
	const idx = new Date().getDay(); // 0=Sun, 1=Mon...
	// JS getDay() is Sun-indexed, DAYS is Mon-indexed
	return DAYS[(idx + 6) % 7];
}

/**
 * Returns a short label for display: "Mon", "Tue", etc.
 */
export function shortDay(day: DayName): string {
	return day.slice(0, 3);
}

/**
 * Returns the default empty attendance for a week
 */
export function emptyWeekAttendance(): Record<DayName, { lunch: boolean; dinner: boolean }> {
	return Object.fromEntries(
		DAYS.map(d => [d, { lunch: true, dinner: true }])
	) as Record<DayName, { lunch: boolean; dinner: boolean }>;
}
