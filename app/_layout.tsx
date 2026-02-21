import { Tabs } from 'expo-router';

export default function TabLayout() {
	return (
		<Tabs>
			<Tabs.Screen name="index" options={{ title: 'Home' }} />
			<Tabs.Screen name="customers" options={{ title: 'Customers' }} />
			<Tabs.Screen name="payments" options={{ title: 'Payments' }} />
			<Tabs.Screen name="finance" options={{ title: 'Finance' }} />
			<Tabs.Screen name="menu" options={{ title: 'Menu' }} />
		</Tabs>
	);
}
