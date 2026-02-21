export type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export const DAYS: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const shortDay = (day: DayName) => day.slice(0, 3);

export const getWeekId = () => {
	const d = new Date();
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
};

export const getTodayName = (): DayName => {
	const days: DayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	return days[new Date().getDay()];
};

export const emptyWeekAttendance = () => {
	const obj: any = {};
	DAYS.forEach(d => obj[d] = { lunch: true, dinner: true });
	return obj as Record<DayName, { lunch: boolean; dinner: boolean }>;
};

export const formatISO = (date: Date) => date.toISOString().split('T')[0];

export const getDatesForWeek = (weekId: string): string[] => {
	const [yearStr, weekStr] = weekId.split('-W');
	const year = parseInt(yearStr);
	const week = parseInt(weekStr);

	// Start with Jan 4th of that year
	const jan4 = new Date(year, 0, 4);
	const day = jan4.getDay(); // 0-6
	// ISO week 1 is the week containing the first Thursday
	const mon1 = new Date(jan4.getTime() - ((day === 0 ? 6 : day - 1) * 86400000));

	// Add (week - 1) weeks
	const monday = new Date(mon1.getTime() + (week - 1) * 7 * 86400000);

	return DAYS.map((_, i) => {
		const d = new Date(monday.getTime() + i * 86400000);
		return formatISO(d);
	});
};

export const getDateForDayName = (dayName: DayName, weekId: string): string => {
	const dates = getDatesForWeek(weekId);
	const idx = DAYS.indexOf(dayName);
	return dates[idx];
};
