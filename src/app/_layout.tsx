import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Theme } from '../constants/Theme';

export default function TabLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<Tabs
				screenOptions={{
					headerShown: false,
					tabBarStyle: styles.tabBar,
					tabBarActiveTintColor: Theme.colors.primary,
					tabBarInactiveTintColor: Theme.colors.textMuted,
					tabBarLabelStyle: styles.tabLabel,
				}}
			>
				<Tabs.Screen
					name="index"
					options={{
						title: 'Home',
						tabBarIcon: ({ color, focused }) => (
							<MaterialCommunityIcons
								name={focused ? "silverware-fork-knife" : "silverware-variant"}
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
						tabBarIcon: ({ color, focused }) => (
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
						tabBarIcon: ({ color, focused }) => (
							<MaterialCommunityIcons
								name={focused ? "cash-multiple" : "cash"}
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
						tabBarIcon: ({ color, focused }) => (
							<MaterialCommunityIcons
								name={focused ? "chart-areaspline" : "chart-areaspline-variant"}
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
						tabBarIcon: ({ color, focused }) => (
							<MaterialCommunityIcons
								name={focused ? "food" : "food-outline"}
								color={color}
								size={26}
							/>
						),
					}}
				/>
			</Tabs>
		</GestureHandlerRootView>
	);
}

const styles = StyleSheet.create({
	tabBar: {
		position: 'absolute',
		bottom: Theme.spacing.huge,
		left: Theme.spacing.screen,
		right: Theme.spacing.screen,
		height: 80,
		backgroundColor: Theme.colors.surface,
		borderRadius: Theme.radius.xl,
		borderTopWidth: 0,
		paddingBottom: Theme.spacing.md,
		paddingTop: Theme.spacing.sm,
		borderWidth: 1.5,
		borderColor: Theme.colors.border,
		shadowColor: '#FF6B35',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 12,
		elevation: 8,
	},
	tabLabel: {
		...Theme.typography.detailBold,
		textTransform: 'uppercase',
	},
});
