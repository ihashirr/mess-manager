import type { DayName } from './weekLogic';

export type RiceSlot = {
	enabled: boolean;
	type: string;
};

export type MealSlot = {
	main: string;
	rice: RiceSlot;
	roti: boolean;
	extra: string;
};

export type DayMenu = {
	lunch: MealSlot;
	dinner: MealSlot;
};

export type WeekMenu = Partial<Record<DayName, DayMenu>>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === 'object' && value !== null;
};

export const createEmptyMeal = (): MealSlot => ({
	main: '',
	rice: { enabled: false, type: '' },
	roti: true,
	extra: '',
});

export const createEmptyDayMenu = (): DayMenu => ({
	lunch: createEmptyMeal(),
	dinner: createEmptyMeal(),
});

export const normalizeMeal = (raw: unknown): MealSlot => {
	const data = isRecord(raw) ? raw : {};
	const riceData = data.rice;
	const legacySide = data.side;

	const rice = isRecord(riceData)
		? {
			enabled: typeof riceData.enabled === 'boolean' ? riceData.enabled : false,
			type: typeof riceData.type === 'string' ? riceData.type : '',
		}
		: {
			enabled: false,
			type: typeof riceData === 'string' ? riceData : '',
		};

	return {
		main: typeof data.main === 'string' ? data.main : '',
		rice,
		roti: typeof data.roti === 'boolean' ? data.roti : true,
		extra: typeof data.extra === 'string'
			? data.extra
			: typeof legacySide === 'string'
				? legacySide
				: '',
	};
};

export const normalizeDayMenu = (raw: unknown): DayMenu => {
	const data = isRecord(raw) ? raw : {};

	return {
		lunch: normalizeMeal(data.lunch),
		dinner: normalizeMeal(data.dinner),
	};
};

export const cloneDayMenu = (menu: DayMenu): DayMenu => ({
	lunch: {
		...menu.lunch,
		rice: { ...menu.lunch.rice },
	},
	dinner: {
		...menu.dinner,
		rice: { ...menu.dinner.rice },
	},
});
