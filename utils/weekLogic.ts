export type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export const DAYS: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const shortDay = (day: DayName) => day.slice(0, 3);

export const getWeekId = () => {
	const d = new Date();
	// ISO week rules: Week 1 is the week with the first Thursday
	// We use local dates to stay consistent with the UI day names
	const dayNum = d.getDay() || 7; // Sunday is 0, so 7
	d.setDate(d.getDate() + 4 - dayNum);
	const yearStart = new Date(d.getFullYear(), 0, 1);
	const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
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

export const formatISO = (date: Date) => {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');
	return `${year}-${month}-${day}`;
};

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

export const getPrevWeekId = (weekId: string): string => {
	const [yearStr, weekStr] = weekId.split('-W');
	let year = parseInt(yearStr);
	let week = parseInt(weekStr);

	if (week === 1) {
		year -= 1;
		// Simplification: Assume 52 weeks, but better to use a library for ISO weeks if parity is critical
		week = 52;
	} else {
		week -= 1;
	}

	return `${year}-W${week.toString().padStart(2, '0')}`;
};
