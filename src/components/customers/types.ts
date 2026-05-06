import { formatISO } from '../../utils/weekLogic';

export type Customer = {
	id: string;
	name: string;
	phone: string;
	address?: {
		location: string;
		flat: string;
	};
	mealsPerDay: { lunch: boolean; dinner: boolean };
	plan?: string;
	pricePerMonth: number;
	startDate: unknown;
	endDate: unknown;
	totalPaid: number;
	notes: string;
	isActive: boolean;
};

export type CustomerFormValues = {
	name: string;
	phone: string;
	location: string;
	flat: string;
	isLunch: boolean;
	isDinner: boolean;
	price: string;
	notes: string;
	startDate: string;
	endDate: string;
};

export const createInitialCustomerFormValues = (): CustomerFormValues => {
	const startDate = formatISO(new Date());
	const endDate = new Date();
	endDate.setMonth(endDate.getMonth() + 1);

	return {
		name: '',
		phone: '',
		location: '',
		flat: '',
		isLunch: true,
		isDinner: false,
		price: '350',
		notes: '',
		startDate,
		endDate: formatISO(endDate),
	};
};
