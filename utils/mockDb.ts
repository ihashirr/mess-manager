import mockCustomersJson from '../mocks/customers.json';
import mockPaymentsJson from '../mocks/payments.json';

// In-memory singletons to simulate a physical database during the app session
let currentMockCustomers = [...mockCustomersJson];
let currentMockPayments = [...mockPaymentsJson];
let currentMockMenu: Record<string, any> = {};
const listeners: Set<() => void> = new Set();

const notify = () => listeners.forEach(l => l());

export const mockDb = {
	getCustomers: () => [...currentMockCustomers],
	getPayments: () => [...currentMockPayments],
	getMenu: (date: string) => currentMockMenu[date] || {},

	updateCustomer: (id: string, updates: any) => {
		currentMockCustomers = currentMockCustomers.map(c =>
			c.id === id ? { ...c, ...updates } : c
		);
		notify();
	},

	addCustomer: (customer: any) => {
		currentMockCustomers = [...currentMockCustomers, customer];
		notify();
	},

	addPayment: (payment: any) => {
		currentMockPayments = [...currentMockPayments, payment];
		notify();
	},

	saveMenu: (date: string, data: any) => {
		currentMockMenu[date] = data;
		notify();
	},

	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}
};
