export type Customer = {
	id: string;
	name: string;
	phone: string;
	address?: {
		location: string;
		flat: string;
	};
	mapLink?: string;
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
	mapLink: string;
	isLunch: boolean;
	isDinner: boolean;
	price: string;
	notes: string;
	startDate: string;
	endDate: string;
};

