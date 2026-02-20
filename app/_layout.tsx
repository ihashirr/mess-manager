import { Tabs } from 'expo-router';
import React, { createContext, useContext, useState } from 'react';

// Simple types for our dummy data
type Customer = {
	id: string;
	name: string;
	plan: string;
	daysLeft: number;
	paymentDue: boolean;
	amount: string;
};

// Initial dummy data
const initialData: Customer[] = [
	{ id: "1", name: "Ahmed", plan: "Lunch", daysLeft: 12, paymentDue: true, amount: "2500" },
	{ id: "2", name: "Bilal", plan: "Dinner", daysLeft: 3, paymentDue: true, amount: "2500" },
	{ id: "3", name: "Sara", plan: "Lunch + Dinner", daysLeft: 0, paymentDue: false, amount: "5000" },
];

// Context to share state without a separate folder
const AppContext = createContext<{
	customers: Customer[];
	markAsPaid: (id: string) => void;
} | null>(null);

export function useAppContent() {
	const context = useContext(AppContext);
	if (!context) throw new Error("useAppContent must be used within a Provider");
	return context;
}

export default function TabLayout() {
	const [customers, setCustomers] = useState<Customer[]>(initialData);

	const markAsPaid = (id: string) => {
		setCustomers(prev => prev.map(c =>
			c.id === id ? { ...c, paymentDue: false } : c
		));
	};

	return (
		<AppContext.Provider value={{ customers, markAsPaid }}>
			<Tabs>
				<Tabs.Screen name="index" options={{ title: 'Home' }} />
				<Tabs.Screen name="customers" options={{ title: 'Customers' }} />
				<Tabs.Screen name="payments" options={{ title: 'Payments' }} />
				<Tabs.Screen name="menu" options={{ title: 'Menu' }} />
			</Tabs>
		</AppContext.Provider>
	);
}
