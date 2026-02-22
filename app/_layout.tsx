import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Theme } from '../constants/Theme';

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarStyle: styles.tabBar,
				tabBarActiveTintColor: Theme.colors.primary,
				tabBarInactiveTintColor: Theme.colors.textDimmed,
				tabBarLabelStyle: styles.tabLabel,
				// @ts-ignore - web only property for clarity
				tabBarItemStyle: { outline: 'none' },
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Home',
					tabBarIcon: ({ color, size, focused }) => (
						<MaterialCommunityIcons
							name={focused ? "view-dashboard" : "view-dashboard-outline"}
							color={color}
							size={26}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="customers"
				options={{
					title: 'Customers',
					tabBarIcon: ({ color, size, focused }) => (
						<MaterialCommunityIcons
							name={focused ? "account-group" : "account-group-outline"}
							color={color}
							size={26}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="payments"
				options={{
					title: 'Payments',
					tabBarIcon: ({ color, size, focused }) => (
						<MaterialCommunityIcons
							name={focused ? "wallet" : "wallet-outline"}
							color={color}
							size={26}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="finance"
				options={{
					title: 'Finance',
					tabBarIcon: ({ color, size, focused }) => (
						<MaterialCommunityIcons
							name={focused ? "chart-box" : "chart-box-outline"}
							color={color}
							size={26}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="menu"
				options={{
					title: 'Menu',
					tabBarIcon: ({ color, size, focused }) => (
						<MaterialCommunityIcons
							name={focused ? "clipboard-text" : "clipboard-text-outline"}
							color={color}
							size={26}
						/>
					),
				}}
			/>
		</Tabs>
	);
}

const styles = StyleSheet.create({
	tabBar: {
		position: 'absolute',
		bottom: 30,
		left: 20,
		right: 20,
		height: 80,
		backgroundColor: Theme.colors.elevated,
		borderRadius: 25,
		borderTopWidth: 0,
		...Theme.shadows.strong,
		paddingBottom: 12,
		paddingTop: 10,
		borderWidth: 1,
		borderColor: '#333333',
	},
	tabLabel: {
		...Theme.typography.label,
		fontSize: 12,
		marginTop: 2,
		textTransform: 'uppercase',
	},
});
