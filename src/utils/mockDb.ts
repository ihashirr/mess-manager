import mockCustomersJson from '../mocks/customers.json';
import mockPaymentsJson from '../mocks/payments.json';
import type { DayMenu } from './menuLogic';

type DateValue = string | Date;
type MockCustomer = Omit<typeof mockCustomersJson[number], 'startDate' | 'endDate'> & {
	address?: { location: string; flat: string };
	startDate: DateValue;
	endDate: DateValue;
};
type MockPayment = Omit<typeof mockPaymentsJson[number], 'date'> & {
	id?: string;
	date: DateValue;
};

// In-memory singletons to simulate a physical database during the app session
let currentMockCustomers: MockCustomer[] = [...mockCustomersJson];
let currentMockPayments: MockPayment[] = mockPaymentsJson.map((payment, index) => ({
	...payment,
	id: `mock-payment-${index}`,
}));
let currentMockMenu: Record<string, DayMenu> = {};
const listeners: Set<() => void> = new Set();

const notify = () => listeners.forEach(l => l());

export const mockDb = {
	getCustomers: () => [...currentMockCustomers],
	getPayments: () => [...currentMockPayments],
	getMenu: (date: string) => currentMockMenu[date] || {},

	updateCustomer: (id: string, updates: Partial<MockCustomer>) => {
		currentMockCustomers = currentMockCustomers.map(c =>
			c.id === id ? { ...c, ...updates } : c
		);
		notify();
	},

	addCustomer: (customer: MockCustomer) => {
		currentMockCustomers = [...currentMockCustomers, customer];
		notify();
	},

	deleteCustomer: (id: string) => {
		currentMockCustomers = currentMockCustomers.filter(c => c.id !== id);
		notify();
	},

	addPayment: (payment: MockPayment) => {
		currentMockPayments = [...currentMockPayments, {
			...payment,
			id: payment.id ?? `mock-payment-${Date.now()}`,
		}];
		notify();
	},

	deletePayment: (id: string) => {
		currentMockPayments = currentMockPayments.filter((payment) => payment.id !== id);
		notify();
	},

	saveMenu: (date: string, data: DayMenu) => {
		currentMockMenu[date] = data;
		notify();
	},

	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}
};
